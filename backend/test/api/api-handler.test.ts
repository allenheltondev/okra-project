import { handler } from '../../src/handlers/api.mjs';

describe('api handler skeleton', () => {
  it('returns health payload for GET /health', async () => {
    const res = await handler({
      rawPath: '/health',
      requestContext: {
        requestId: 'req-1',
        http: { method: 'GET' }
      },
      headers: {}
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-correlation-id']).toBe('req-1');

    const payload = JSON.parse(String(res.body));
    expect(payload.ok).toBe(true);
    expect(payload.service).toBe('okra-project-api');
  });

  it('returns structured not-found payload for unknown route', async () => {
    const res = await handler({
      rawPath: '/does-not-exist',
      requestContext: {
        requestId: 'req-2',
        http: { method: 'GET' }
      },
      headers: {}
    });

    expect(res.statusCode).toBe(404);
    const payload = JSON.parse(String(res.body));
    expect(payload.error.code).toBe('NOT_FOUND');
  });
});
