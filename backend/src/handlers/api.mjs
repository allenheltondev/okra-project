import { Router } from '@aws-lambda-powertools/event-handler/http';
import { getDbPool } from '../lib/db-client.mjs';
import { insertPendingSubmission, validateSubmissionPayload } from '../services/submissions.mjs';

const app = new Router();

app.get('/health', () => {
  return {
    ok: true,
    service: 'okra-project-api',
    runtime: process.version
  };
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

  const pool = await getDbPool();
  const created = await insertPendingSubmission(pool, payload);

  return {
    statusCode: 201,
    body: {
      submissionId: created.id,
      status: created.status,
      createdAt: created.created_at
    }
  };
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
