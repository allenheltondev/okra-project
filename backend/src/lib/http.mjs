function baseHeaders(correlationId) {
  return {
    'content-type': 'application/json',
    'x-correlation-id': correlationId
  };
}

export function json(statusCode, payload, correlationId) {
  return {
    statusCode,
    headers: baseHeaders(correlationId),
    body: JSON.stringify(payload)
  };
}

export function notFound(correlationId) {
  return json(
    404,
    {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found'
      }
    },
    correlationId
  );
}

export function internalError(correlationId) {
  return json(
    500,
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error'
      }
    },
    correlationId
  );
}

export function getCorrelationId(event) {
  return (
    event?.headers?.['x-correlation-id'] ??
    event?.headers?.['X-Correlation-Id'] ??
    event?.requestContext?.requestId ??
    'unknown'
  );
}
