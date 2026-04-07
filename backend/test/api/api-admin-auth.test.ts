import { handler } from '../../src/handlers/api.mjs';

function makeRestApiEvent(path, method = 'GET', headers = {}) {
  return {
    resource: '/{proxy+}',
    path,
    httpMethod: method,
    headers,
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'req-admin-auth',
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

describe('admin auth guard', () => {
  it('returns 401 when bearer token is missing', async () => {
    const res = await handler(makeRestApiEvent('/admin/health'));
    expect(res.statusCode).toBe(401);
  });

  it('allows test bypass for admin route in test env', async () => {
    const res = await handler(makeRestApiEvent('/admin/health', 'GET', { 'x-test-admin': 'true' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body));
    expect(body.admin).toBe(true);
  });
});
