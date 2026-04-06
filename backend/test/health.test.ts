import { handler } from '../src/handlers/api.mjs';

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
      requestId: 'health-req',
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

const lambdaContext = {
  awsRequestId: 'health-request-id',
  getRemainingTimeInMillis: () => 30_000
};

describe('health endpoint', () => {
  it('returns 200 and ok payload', async () => {
    const res = await handler(makeRestApiEvent('/health'), lambdaContext);

    expect(res.statusCode).toBe(200);

    const parsed = JSON.parse(String(res.body ?? '{}'));
    expect(parsed.ok).toBe(true);
  });
});
