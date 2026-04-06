import { Router } from '@aws-lambda-powertools/event-handler/http';
import { IdempotencyConfig, makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { validate } from '@aws-lambda-powertools/validation';
import { SchemaValidationError } from '@aws-lambda-powertools/validation/errors';
import { getDbPool } from '../lib/db-client.mjs';
import { insertPendingSubmission } from '../services/submissions.mjs';
import {
  createSubmissionRequestSchema,
  createSubmissionResponseSchema
} from '../schemas/submissions.mjs';

const app = new Router();

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME
});

const idempotentCreateSubmission = makeIdempotent(
  async ({ payload }) => {
    const pool = await getDbPool();
    const created = await insertPendingSubmission(pool, payload);

    return {
      submissionId: created.id,
      status: created.status,
      createdAt: created.created_at
    };
  },
  {
    persistenceStore,
    config: new IdempotencyConfig({
      eventKeyJmesPath: 'idempotencyKey',
      throwOnNoIdempotencyKey: false,
      expiresAfterSeconds: 60 * 60 * 24
    })
  }
);

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
  try {
    const payload = validate({
      payload: await req.json(),
      schema: createSubmissionRequestSchema
    });

    const idempotencyKey = req.headers.get('idempotency-key') ?? req.headers.get('Idempotency-Key') ?? '';

    const body = await idempotentCreateSubmission({
      idempotencyKey,
      payload
    });

    validate({
      payload: body,
      schema: createSubmissionResponseSchema
    });

    return {
      statusCode: 201,
      body
    };
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return {
        statusCode: 422,
        body: {
          error: 'RequestValidationError',
          message: 'Validation failed for request',
          details: {
            issues: error.cause?.issues ?? []
          }
        }
      };
    }

    throw error;
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
