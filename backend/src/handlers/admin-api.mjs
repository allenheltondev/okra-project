import { Router } from '@aws-lambda-powertools/event-handler/http';
import { registerAdminRoutes } from './admin-routes.mjs';

const app = new Router();

app.get('/health', async ({ event }) => {
  const authorizer = event.requestContext?.authorizer ?? {};

  return {
    statusCode: 200,
    body: {
      ok: true,
      admin: true,
      subject: authorizer.sub ?? 'unknown'
    }
  };
});

registerAdminRoutes(app);

app.notFound(() => {
  return new Response(
    JSON.stringify({
      error: {
        code: 'NOT_FOUND',
        message: 'Admin route not found'
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

export const handler = async (event, context) => app.resolve(event, context);
