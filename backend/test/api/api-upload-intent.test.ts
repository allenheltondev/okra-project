import { handler } from '../../src/handlers/api.mjs';

function makeRestApiEvent(path, method = 'POST', body = null) {
  return {
    resource: '/{proxy+}',
    path,
    httpMethod: method,
    headers: {
      'content-type': 'application/json'
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'req-upload-intent',
      path,
      stage: 'api',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'vitest'
      }
    },
    body,
    isBase64Encoded: false
  };
}

describe('upload intent endpoint validation', () => {
  it('returns 422 for invalid submissionId and missing contentType', async () => {
    const res = await handler(
      makeRestApiEvent(
        '/submissions/not-a-uuid/photos/upload-intent',
        'POST',
        JSON.stringify({ fileName: 'okra.jpg' })
      )
    );

    expect(res.statusCode).toBe(422);
    const payload = JSON.parse(String(res.body));
    expect(payload.error).toBe('RequestValidationError');
    expect(payload.details.issues.length).toBeGreaterThan(0);
  });
});
