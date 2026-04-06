import { handler } from '../../src/handlers/api.mjs';

function makeRestApiEvent(path, method = 'GET') {
  return {
    resource: '/{proxy+}',
    path,
    httpMethod: method,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'req-1',
      path,
      stage: 'api',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'vitest'
      }
    },
    body: null,
    isBase64Encoded: false
  };
}

describe('api handler skeleton', () => {
  it('returns health payload for GET /health', async () => {
    const res = await handler(makeRestApiEvent('/health'));

    expect(res.statusCode).toBe(200);

    const payload = JSON.parse(String(res.body));
    expect(payload.ok).toBe(true);
    expect(payload.service).toBe('okra-project-api');
  });

  it('returns not-found payload for unknown route', async () => {
    const res = await handler(makeRestApiEvent('/does-not-exist'));

    expect(res.statusCode).toBe(404);
  });
});
