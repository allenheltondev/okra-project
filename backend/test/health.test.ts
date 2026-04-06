import { handler } from '../src/handlers/api.mjs';

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
      requestId: 'health-req',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 0
    },
    isBase64Encoded: false
  };
}

describe('health endpoint', () => {
  it('returns 200 and ok payload', async () => {
    const res = await handler(makeHttpApiEvent('/health'));

    expect(res.statusCode).toBe(200);

    const parsed = JSON.parse(String(res.body ?? '{}'));
    expect(parsed.ok).toBe(true);
  });
});
