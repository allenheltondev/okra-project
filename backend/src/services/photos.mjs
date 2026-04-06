import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const VALID_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getMediaBucketName() {
  const bucket = process.env.MEDIA_BUCKET_NAME;
  if (!bucket) {
    throw new Error('MEDIA_BUCKET_NAME is required');
  }
  return bucket;
}

function getAwsRegion() {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
}

export function validateUploadIntentPayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, issues: ['Body must be a JSON object'] };
  }

  if (!payload.contentType || typeof payload.contentType !== 'string') {
    issues.push('contentType is required');
  } else if (!VALID_CONTENT_TYPES.has(payload.contentType)) {
    issues.push('contentType must be one of: image/jpeg, image/png, image/webp');
  }

  if (payload.fileName && typeof payload.fileName !== 'string') {
    issues.push('fileName must be a string when provided');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function ensureSubmissionExists(client, submissionId) {
  const result = await client.query('select id from submissions where id = $1', [submissionId]);
  return result.rowCount > 0;
}

export async function createUploadIntent(client, submissionId, payload) {
  const exists = await ensureSubmissionExists(client, submissionId);
  if (!exists) {
    const error = new Error('submission not found');
    error.code = 'SUBMISSION_NOT_FOUND';
    throw error;
  }

  const mediaBucket = getMediaBucketName();
  const photoId = randomUUID();
  const objectKey = `submissions/${submissionId}/${photoId}/original`;

  await client.query(
    `
      insert into submission_photos (
        id,
        submission_id,
        original_s3_bucket,
        original_s3_key,
        status
      ) values ($1, $2, $3, $4, 'uploaded')
    `,
    [photoId, submissionId, mediaBucket, objectKey]
  );

  const s3 = new S3Client({ region: getAwsRegion() });
  const command = new PutObjectCommand({
    Bucket: mediaBucket,
    Key: objectKey,
    ContentType: payload.contentType
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  return {
    photoId,
    uploadUrl,
    method: 'PUT',
    headers: {
      'content-type': payload.contentType
    },
    s3Key: objectKey,
    expiresInSeconds: 900
  };
}
