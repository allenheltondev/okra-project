import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createDbClient } from '../../scripts/db-client.mjs';

const s3 = new S3Client({});
const eventBridge = new EventBridgeClient({});

export function errorResponse(statusCode, code, message) {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status: statusCode, headers: { 'content-type': 'application/json' } }
  );
}

export function encodeCursor(row) {
  return Buffer.from(
    JSON.stringify({ created_at: row.created_at.toISOString(), id: row.id })
  ).toString('base64url');
}

export function decodeCursor(token) {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!parsed.created_at || !parsed.id) return null;

    // Validate created_at is a valid ISO 8601 timestamp
    const ts = new Date(parsed.created_at);
    if (isNaN(ts.getTime())) return null;

    // Validate id is a valid UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)) return null;

    return { created_at: parsed.created_at, id: parsed.id };
  } catch {
    return null;
  }
}

export async function presignPhotoUrl(bucket, key, expiresIn = 900) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

const VALID_STATUSES = ['pending_review', 'approved', 'denied'];
const VALID_ACTIONS = ['approved', 'denied'];
const VALID_DENIAL_REASONS = ['spam', 'invalid_location', 'inappropriate', 'other'];

export function registerAdminRoutes(app) {
  // ─── GET /admin/submissions ───────────────────────────────────────────
  app.get('/admin/submissions', async (ctx) => {
    const params = ctx.event.queryStringParameters || {};
    const status = params.status || 'pending_review';
    if (!VALID_STATUSES.includes(status)) {
      return errorResponse(400, 'INVALID_STATUS', `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    let limit = 20;
    if (params.limit !== undefined && params.limit !== null) {
      const parsed = Number(params.limit);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        return errorResponse(400, 'INVALID_LIMIT', 'Limit must be a positive integer');
      }
      limit = Math.min(parsed, 100);
    }

    let cursor = null;
    if (params.cursor !== undefined && params.cursor !== null && params.cursor !== '') {
      cursor = decodeCursor(params.cursor);
      if (!cursor) {
        return errorResponse(400, 'INVALID_CURSOR', 'Malformed cursor token');
      }
    }

    const client = await createDbClient();
    await client.connect();
    try {
      let queryText;
      let queryParams;
      if (cursor) {
        queryText = `
          SELECT s.id, s.contributor_name, s.story_text, s.raw_location_text,
                 s.privacy_mode, s.display_lat, s.display_lng, s.status, s.created_at
          FROM submissions s
          WHERE s.status = $1 AND (s.created_at, s.id) > ($2, $3)
          ORDER BY s.created_at ASC, s.id ASC
          LIMIT $4
        `;
        queryParams = [status, cursor.created_at, cursor.id, limit + 1];
      } else {
        queryText = `
          SELECT s.id, s.contributor_name, s.story_text, s.raw_location_text,
                 s.privacy_mode, s.display_lat, s.display_lng, s.status, s.created_at
          FROM submissions s
          WHERE s.status = $1
          ORDER BY s.created_at ASC, s.id ASC
          LIMIT $2
        `;
        queryParams = [status, limit + 1];
      }

      const submissionsResult = await client.query(queryText, queryParams);
      const rows = submissionsResult.rows;

      let nextCursor = null;
      if (rows.length > limit) {
        rows.pop();
        const lastRow = rows[rows.length - 1];
        nextCursor = encodeCursor(lastRow);
      }

      if (rows.length === 0) {
        return { data: [], cursor: null };
      }

      const submissionIds = rows.map((r) => r.id);
      const photosResult = await client.query(
        `SELECT submission_id, original_s3_key
         FROM submission_photos
         WHERE submission_id = ANY($1)
         ORDER BY submission_id, created_at ASC`,
        [submissionIds]
      );

      const photosBySubmission = {};
      for (const photo of photosResult.rows) {
        if (!photosBySubmission[photo.submission_id]) {
          photosBySubmission[photo.submission_id] = [];
        }
        photosBySubmission[photo.submission_id].push(photo.original_s3_key);
      }

      const bucket = process.env.MEDIA_BUCKET_NAME;
      const data = await Promise.all(
        rows.map(async (row) => {
          const keys = photosBySubmission[row.id] || [];
          const photos = await Promise.all(keys.map((key) => presignPhotoUrl(bucket, key)));
          return {
            id: row.id, contributor_name: row.contributor_name,
            story_text: row.story_text, raw_location_text: row.raw_location_text,
            privacy_mode: row.privacy_mode, display_lat: row.display_lat,
            display_lng: row.display_lng, status: row.status,
            created_at: row.created_at, photo_count: photos.length,
            has_photos: photos.length > 0, photos
          };
        })
      );

      return { data, cursor: nextCursor };
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        message: err instanceof Error ? err.message : String(err),
        errorName: err instanceof Error ? err.name : 'UnknownError',
        endpoint: 'GET /admin/submissions'
      }));
      return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    } finally {
      await client.end();
    }
  });

  // ─── POST /admin/submissions/:id/statuses ─────────────────────────────
  app.post('/admin/submissions/:id/statuses', async (ctx) => {
    const submissionId = ctx.params.id;
    const body = JSON.parse(ctx.event.body || '{}');
    const { status, review_notes, display_lat, display_lng, reason } = body;

    // Validate status field
    if (!status || !VALID_ACTIONS.includes(status)) {
      return errorResponse(400, 'INVALID_ACTION', 'status must be one of: approved, denied');
    }

    if (status === 'approved') {
      return handleApproval(ctx, submissionId, { review_notes, display_lat, display_lng });
    }

    return handleDenial(ctx, submissionId, { reason, review_notes });
  });
}

async function handleApproval(ctx, submissionId, { review_notes, display_lat, display_lng }) {
  const hasLat = display_lat !== undefined && display_lat !== null;
  const hasLng = display_lng !== undefined && display_lng !== null;
  if (hasLat !== hasLng) {
    return errorResponse(400, 'INVALID_COORDINATES', 'Both display_lat and display_lng must be provided together');
  }
  if (hasLat && hasLng) {
    if (typeof display_lat !== 'number' || typeof display_lng !== 'number' ||
        display_lat < -90 || display_lat > 90 || display_lng < -180 || display_lng > 180) {
      return errorResponse(400, 'INVALID_COORDINATES', 'display_lat must be between -90 and 90, display_lng must be between -180 and 180');
    }
  }

  const client = await createDbClient();
  await client.connect();
  try {
    // Verify submission exists and is pending before anything else
    const existsResult = await client.query(
      'SELECT id, status FROM submissions WHERE id = $1', [submissionId]
    );
    if (existsResult.rows.length === 0) {
      return errorResponse(404, 'NOT_FOUND', 'Submission not found');
    }
    if (existsResult.rows[0].status !== 'pending_review') {
      return errorResponse(409, 'INVALID_STATE', `Submission is already ${existsResult.rows[0].status}`);
    }

    const photoCountResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM submission_photos WHERE submission_id = $1',
      [submissionId]
    );
    if (photoCountResult.rows[0].count === 0) {
      return errorResponse(400, 'MISSING_PHOTOS', 'At least one photo is required for approval');
    }

    const cognitoSub = ctx.event.requestContext?.authorizer?.sub || 'system';
    const adminResult = await client.query(
      'SELECT id FROM admin_users WHERE cognito_sub = $1', [cognitoSub]
    );
    const adminUserId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;
    if (!adminUserId) {
      return errorResponse(403, 'FORBIDDEN', 'Admin user not found');
    }

    await client.query('BEGIN');

    let updateText;
    let updateParams;
    if (hasLat && hasLng) {
      updateText = `UPDATE submissions
        SET status = 'approved', reviewed_by = $2, reviewed_at = now(),
            review_notes = $3, display_lat = $4, display_lng = $5
        WHERE id = $1 AND status = 'pending_review' RETURNING *`;
      updateParams = [submissionId, adminUserId, review_notes || null, display_lat, display_lng];
    } else {
      updateText = `UPDATE submissions
        SET status = 'approved', reviewed_by = $2, reviewed_at = now(),
            review_notes = $3
        WHERE id = $1 AND status = 'pending_review' RETURNING *`;
      updateParams = [submissionId, adminUserId, review_notes || null];
    }

    const updateResult = await client.query(updateText, updateParams);
    if (updateResult.rowCount === 0) {
      // Race condition: status changed between our check and the update
      await client.query('ROLLBACK');
      return errorResponse(409, 'INVALID_STATE', 'Submission status changed during processing');
    }

    const row = updateResult.rows[0];
    await client.query(
      `INSERT INTO submission_reviews (submission_id, action, reviewed_by, reviewed_at, notes)
       VALUES ($1, 'approved', $2, now(), $3)`,
      [submissionId, adminUserId, review_notes || null]
    );
    await client.query('COMMIT');

    const response = {
      id: row.id, contributor_name: row.contributor_name,
      story_text: row.story_text, raw_location_text: row.raw_location_text,
      privacy_mode: row.privacy_mode, display_lat: row.display_lat,
      display_lng: row.display_lng, status: row.status,
      reviewed_by: row.reviewed_by, reviewed_at: row.reviewed_at,
      review_notes: row.review_notes, created_at: row.created_at
    };
    if (row.display_lat === 0 && row.display_lng === 0) {
      response.warnings = [{ code: 'SUSPICIOUS_COORDINATES', message: 'Coordinates are at 0,0 -- verify location is correct' }];
    }
    return response;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(JSON.stringify({
      level: 'error',
      message: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : 'UnknownError',
      endpoint: 'POST /admin/submissions/:id/statuses', submissionId
    }));
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  } finally {
    await client.end();
  }
}

async function handleDenial(ctx, submissionId, { reason, review_notes }) {
  if (!reason || !VALID_DENIAL_REASONS.includes(reason)) {
    return errorResponse(400, 'INVALID_REASON', `Invalid reason. Must be one of: ${VALID_DENIAL_REASONS.join(', ')}`);
  }
  if (reason === 'other' && (!review_notes || review_notes.trim() === '')) {
    return errorResponse(400, 'MISSING_NOTES', 'review_notes is required when reason is "other"');
  }

  const client = await createDbClient();
  await client.connect();
  try {
    const cognitoSub = ctx.event.requestContext?.authorizer?.sub || 'system';
    const adminResult = await client.query(
      'SELECT id FROM admin_users WHERE cognito_sub = $1', [cognitoSub]
    );
    const adminUserId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;
    if (!adminUserId) {
      return errorResponse(403, 'FORBIDDEN', 'Admin user not found');
    }

    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE submissions
       SET status = 'denied', reviewed_by = $2, reviewed_at = now(), review_notes = $3
       WHERE id = $1 AND status = 'pending_review' RETURNING *`,
      [submissionId, adminUserId, review_notes || null]
    );

    if (updateResult.rowCount === 0) {
      const existsResult = await client.query(
        'SELECT id, status FROM submissions WHERE id = $1', [submissionId]
      );
      await client.query('ROLLBACK');
      if (existsResult.rows.length === 0) {
        return errorResponse(404, 'NOT_FOUND', 'Submission not found');
      }
      return errorResponse(409, 'INVALID_STATE', `Submission is already ${existsResult.rows[0].status}`);
    }

    const row = updateResult.rows[0];
    await client.query(
      `INSERT INTO submission_reviews (submission_id, action, reason, reviewed_by, reviewed_at, notes)
       VALUES ($1, 'denied', $2, $3, now(), $4)`,
      [submissionId, reason, adminUserId, review_notes || null]
    );
    await client.query('COMMIT');

    try {
      await eventBridge.send(new PutEventsCommand({
        Entries: [{
          Source: 'okra-project',
          DetailType: 'SubmissionDenied',
          Detail: JSON.stringify({ submissionId })
        }]
      }));
    } catch (ebErr) {
      console.error(JSON.stringify({
        level: 'warn',
        message: 'Failed to publish cleanup event',
        submissionId,
        error: ebErr instanceof Error ? ebErr.message : String(ebErr)
      }));
    }

    return {
      id: row.id, contributor_name: row.contributor_name,
      story_text: row.story_text, raw_location_text: row.raw_location_text,
      privacy_mode: row.privacy_mode, display_lat: row.display_lat,
      display_lng: row.display_lng, status: row.status,
      reviewed_by: row.reviewed_by, reviewed_at: row.reviewed_at,
      review_notes: row.review_notes, created_at: row.created_at
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(JSON.stringify({
      level: 'error',
      message: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : 'UnknownError',
      endpoint: 'POST /admin/submissions/:id/statuses', submissionId
    }));
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  } finally {
    await client.end();
  }
}
