import { getCorrelationId, internalError, json, notFound } from '../lib/http.mjs';

function health(correlationId) {
  return json(
    200,
    {
      ok: true,
      service: 'okra-project-api',
      runtime: process.version
    },
    correlationId
  );
}

function version(correlationId) {
  return json(
    200,
    {
      ok: true,
      version: '0.1.0'
    },
    correlationId
  );
}

export const handler = async (event) => {
  const correlationId = getCorrelationId(event);
  const method = event?.requestContext?.http?.method ?? event?.httpMethod;
  const rawPath = event?.rawPath ?? event?.path ?? '/';

  try {
    if (method === 'GET' && rawPath === '/health') {
      return health(correlationId);
    }

    if (method === 'GET' && rawPath === '/version') {
      return version(correlationId);
    }

    return notFound(correlationId);
  } catch (error) {
    console.error('[api] unhandled error', { correlationId, error });
    return internalError(correlationId);
  }
};
