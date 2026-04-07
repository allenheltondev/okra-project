import { Router } from '@aws-lambda-powertools/event-handler/http';
import { requireAdminAccess } from '../services/auth.mjs';

const app = new Router();

app.get('/health', async ({ event }) => {
  const auth = await requireAdminAccess(event);
  if (!auth.ok) {
    return {
      statusCode: auth.statusCode,
      body: auth.body
    };
  }

  return {
    statusCode: 200,
    body: {
      ok: true,
      admin: true,
      subject: auth.payload.sub
    }
  };
});

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
