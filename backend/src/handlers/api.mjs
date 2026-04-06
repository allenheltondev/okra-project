import { Router } from '@aws-lambda-powertools/event-handler/http';
import { IdempotencyConfig, makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { validate } from '@aws-lambda-powertools/validation';
import { SchemaValidationError } from '@aws-lambda-powertools/validation/errors';
import { getDbPool } from '../lib/db-client.mjs';
import { insertPendingSubmission } from '../services/submissions.mjs';
import {
  createSubmissionRequestSchema,
  createSubmissionResponseSchema
} from '../schemas/submissions.mjs';

const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME ?? 'okra-project-api'
});

const app = new Router({ logger });

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME
});

const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmesPath: 'idempotencyKey',
  throwOnNoIdempotencyKey: false,
  expiresAfterSeconds: 60 * 60 * 24
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
    config: idempotencyConfig
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
    logger.info('Handling POST /submissions');

    const payload = validate({
      payload: await req.json(),
      schema: createSubmissionRequestSchema
    });

    const idempotencyKey =
      req.headers.get('idempotency-key') ?? req.headers.get('Idempotency-Key') ?? '';

    const body = idempotencyKey
      ? await idempotentCreateSubmission({ idempotencyKey, payload })
      : await (async () => {
          logger.info('No Idempotency-Key header provided; processing as non-idempotent request');
          const pool = await getDbPool();
          const created = await insertPendingSubmission(pool, payload);
          return {
            submissionId: created.id,
            status: created.status,
            createdAt: created.created_at
          };
        })();

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
      logger.warn('Submission validation failed', {
        issues: error.cause?.issues ?? []
      });

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

    logger.error('Submission handler failed', {
      error: error instanceof Error ? error.message : String(error)
    });

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
  logger.addContext(context);
  idempotencyConfig.registerLambdaContext(context);

  const method = event?.httpMethod ?? event?.requestContext?.http?.method ?? 'UNKNOWN';
  const path = event?.path ?? event?.rawPath ?? 'UNKNOWN';

  logger.info('Incoming API request', {
    method,
    path,
    requestId: context?.awsRequestId
  });

  try {
    return await app.resolve(event, context);
  } catch (error) {
    logger.error('Unhandled API error', {
      method,
      path,
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
};
