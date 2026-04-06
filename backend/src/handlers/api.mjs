import { Router } from '@aws-lambda-powertools/event-handler/http';

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
