import { handler } from '../../src/handlers/api.mjs';

function makeHttpApiEvent(path, method = 'GET') {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'example',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest'
      },
      requestId: 'req-1',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 0
    },
    isBase64Encoded: false
  };
}

describe('api handler skeleton', () => {
  it('returns health payload for GET /health', async () => {
    const res = await handler(makeHttpApiEvent('/health'));

    expect(res.statusCode).toBe(200);

    const payload = JSON.parse(String(res.body));
    expect(payload.ok).toBe(true);
    expect(payload.service).toBe('okra-project-api');
  });

  it('returns not-found payload for unknown route', async () => {
    const res = await handler(makeHttpApiEvent('/does-not-exist'));

    expect(res.statusCode).toBe(404);
  });
});
