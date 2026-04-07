import { Router } from '@aws-lambda-powertools/event-handler/http';
import { validate } from '@aws-lambda-powertools/validation';
import { SchemaValidationError } from '@aws-lambda-powertools/validation/errors';
import { createDbClient } from '../../scripts/db-client.mjs';
import {
  createPhotoUploadIntent,
  enforcePhotoRateLimit,
  photoCreateSchema
} from '../services/photos.mjs';
import { enqueuePhotoProcessing } from '../services/photo-processing-queue.mjs';
import { insertPendingSubmissionWithPhotos, submissionSchema } from '../services/submissions.mjs';

const app = new Router();

app.get('/health', async () => {
  const response = {
    ok: true,
    service: 'okra-project-api',
    runtime: process.version
  };

  if (process.env.DATABASE_URL) {
    try {
      const client = await createDbClient();
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      response.db = 'connected';
    } catch (error) {
      response.ok = false;
      response.db = 'error';
      response.error = error.message;
    }
  } else {
    response.db = 'not configured';
  }

  return response;
});

app.get('/version', () => {
  return {
    ok: true,
    version: '0.1.0'
  };
});

app.post('/photos', async ({ req, event }) => {
  const payload = await req.json();

  try {
    validate({ payload, schema: photoCreateSchema });
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return {
        statusCode: 422,
        body: {
          error: 'RequestValidationError',
          message: 'Validation failed for request',
          details: {
            issues: error.errors?.map((e) => e.message) ?? [error.message]
          }
        }
      };
    }
    throw error;
  }

  const sourceIp = event?.requestContext?.identity?.sourceIp ?? 'unknown';

  const client = await createDbClient();
  await client.connect();

  try {
    await enforcePhotoRateLimit(client, sourceIp);

    const intent = await createPhotoUploadIntent(client, payload, sourceIp);
    return {
      statusCode: 201,
      body: intent
    };
  } catch (error) {
    if (error?.code === 'PHOTO_RATE_LIMITED') {
      return {
        statusCode: 429,
        body: {
          error: 'RateLimitExceeded',
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds
        }
      };
    }

    throw error;
  } finally {
    await client.end();
  }
});

app.post('/submissions', async ({ req }) => {
  const payload = await req.json();

  try {
    validate({ payload, schema: submissionSchema });
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return {
        statusCode: 422,
        body: {
          error: 'RequestValidationError',
          message: 'Validation failed for request',
          details: {
            issues: error.errors?.map((e) => e.message) ?? [error.message]
          }
        }
      };
    }
    throw error;
  }

  const client = await createDbClient();
  await client.connect();

  try {
    const created = await insertPendingSubmissionWithPhotos(client, payload);

    await enqueuePhotoProcessing(created.claimedPhotoIds);

    return {
      statusCode: 201,
      body: {
        submissionId: created.id,
        status: created.status,
        createdAt: created.created_at
      }
    };
  } catch (error) {
    if (error?.code === 'INVALID_PHOTO_IDS') {
      return {
        statusCode: 422,
        body: {
          error: 'InvalidPhotoIds',
          message: error.message
        }
      };
    }

    if ((error?.message ?? '').includes('Failed to publish')) {
      return {
        statusCode: 502,
        body: {
          error: 'PhotoProcessingQueueError',
          message: 'Submission saved but photo processing queueing failed'
        }
      };
    }

    throw error;
  } finally {
    await client.end();
  }
});


app.notFound(() => {
  return new Response(
    JSON.stringify({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found'
      }
    }),
    {
      status: 404,
      headers: {
        'content-type': 'application/json'
      }
    }
  );
});

export const handler = async (event, context) => {
  return app.resolve(event, context);
};
