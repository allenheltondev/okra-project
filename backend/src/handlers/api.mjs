import { Router } from '@aws-lambda-powertools/event-handler/http';
import { createDbClient } from '../../scripts/db-client.mjs';

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
