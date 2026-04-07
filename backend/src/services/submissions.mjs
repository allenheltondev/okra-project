import { isUuid } from './photos.mjs';

export const VALID_PRIVACY_MODES = new Set(['exact', 'nearby', 'neighborhood', 'city']);

export function validateSubmissionPayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, issues: ['Body must be a JSON object'] };
  }

  if (!payload.rawLocationText || typeof payload.rawLocationText !== 'string') {
    issues.push('rawLocationText is required');
  }

  if (typeof payload.displayLat !== 'number' || Number.isNaN(payload.displayLat)) {
    issues.push('displayLat must be a valid number');
  } else if (payload.displayLat < -90 || payload.displayLat > 90) {
    issues.push('displayLat must be between -90 and 90');
  }

  if (typeof payload.displayLng !== 'number' || Number.isNaN(payload.displayLng)) {
    issues.push('displayLng must be a valid number');
  } else if (payload.displayLng < -180 || payload.displayLng > 180) {
    issues.push('displayLng must be between -180 and 180');
  }

  if (payload.privacyMode && !VALID_PRIVACY_MODES.has(payload.privacyMode)) {
    issues.push('privacyMode must be one of: exact, nearby, neighborhood, city');
  }

  if (!Array.isArray(payload.photoIds) || payload.photoIds.length === 0) {
    issues.push('photoIds must contain at least one photoId');
  } else {
    const invalid = payload.photoIds.some((id) => typeof id !== 'string' || !isUuid(id));
    if (invalid) {
      issues.push('photoIds must be valid UUID strings');
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export async function insertPendingSubmissionWithPhotos(client, payload) {
  await client.query('begin');

  try {
    const submissionResult = await client.query(
      `
        insert into submissions (
          contributor_name,
          contributor_email,
          story_text,
          raw_location_text,
          privacy_mode,
          display_lat,
          display_lng,
          status
        ) values ($1, $2, $3, $4, $5, $6, $7, 'pending_review')
        returning id, status, created_at
      `,
      [
        payload.contributorName ?? null,
        payload.contributorEmail ?? null,
        payload.storyText ?? null,
        payload.rawLocationText,
        payload.privacyMode ?? 'city',
        payload.displayLat,
        payload.displayLng
      ]
    );

    const created = submissionResult.rows[0];

    const claimResult = await client.query(
      `
        update submission_photos
        set submission_id = $1,
            claimed_at = now(),
            expires_at = null
        where id = any($2::uuid[])
          and submission_id is null
          and (expires_at is null or expires_at > now())
      `,
      [created.id, payload.photoIds]
    );

    if (claimResult.rowCount !== payload.photoIds.length) {
      throw Object.assign(new Error('One or more photoIds are invalid, expired, or already claimed'), {
        code: 'INVALID_PHOTO_IDS'
      });
    }

    await client.query('commit');
    return {
      ...created,
      claimedPhotoIds: payload.photoIds
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
