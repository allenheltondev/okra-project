import { handler } from '../src/handlers/api.mjs';

describe('health endpoint', () => {
  it('returns 200 and ok payload', async () => {
    const res = await handler({
      rawPath: '/health',
      requestContext: {
        requestId: 'health-req',
        http: { method: 'GET' }
      },
      headers: {}
    });

    expect(res.statusCode).toBe(200);

    const parsed = JSON.parse(String(res.body ?? '{}')) as { ok?: boolean };
    expect(parsed.ok).toBe(true);
  });
});
