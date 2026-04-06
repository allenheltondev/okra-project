import { Router } from '@aws-lambda-powertools/event-handler/http';
import { createDbClient } from '../../scripts/db-client.mjs';

const app = new Router();

app.get('/health', async () => {
  try {
    const client = await createDbClient();
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return {
      ok: true,
      service: 'okra-project-api',
      runtime: process.version,
      db: 'connected'
    };
  } catch (error) {
    return {
      ok: false,
      service: 'okra-project-api',
      runtime: process.version,
      db: 'error',
      error: error.message
    };
  }
});

app.get('/version', () => {
  return {
    ok: true,
    version: '0.1.0'
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
