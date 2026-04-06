import { Router } from '@aws-lambda-powertools/event-handler/http';
import { createDbClient } from '../../scripts/db-client.mjs';
import { createUploadIntent, isUuid, validateUploadIntentPayload } from '../services/photos.mjs';
import { insertPendingSubmission, validateSubmissionPayload } from '../services/submissions.mjs';

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

app.post('/submissions', async ({ req }) => {
  const payload = await req.json();
  const validation = validateSubmissionPayload(payload);

  if (!validation.valid) {
    return {
      statusCode: 422,
      body: {
        error: 'RequestValidationError',
        message: 'Validation failed for request',
        details: {
          issues: validation.issues
        }
      }
    };
  }

  const client = await createDbClient();
  await client.connect();

  try {
    const created = await insertPendingSubmission(client, payload);
    return {
      statusCode: 201,
      body: {
        submissionId: created.id,
        status: created.status,
        createdAt: created.created_at
      }
    };
  } finally {
    await client.end();
  }
});

app.post('/submissions/:submissionId/photos/upload-intent', async ({ req, params }) => {
  const submissionId = params?.submissionId;
  const payload = await req.json();

  const issues = [];
  if (!submissionId || !isUuid(submissionId)) {
    issues.push('submissionId path parameter must be a valid UUID');
  }

  const validation = validateUploadIntentPayload(payload);
  issues.push(...validation.issues);

  if (issues.length > 0) {
    return {
      statusCode: 422,
      body: {
        error: 'RequestValidationError',
        message: 'Validation failed for request',
        details: {
          issues
        }
      }
    };
  }

  const client = await createDbClient();
  await client.connect();

  try {
    const intent = await createUploadIntent(client, submissionId, payload);
    return {
      statusCode: 201,
      body: intent
    };
  } catch (error) {
    if (error?.code === 'SUBMISSION_NOT_FOUND') {
      return {
        statusCode: 404,
        body: {
          error: 'SubmissionNotFound',
          message: `Submission ${submissionId} was not found`
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
