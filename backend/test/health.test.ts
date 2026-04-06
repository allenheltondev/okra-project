import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { handler } from '../src/handlers/health';

describe('health handler', () => {
  it('returns 200 and ok payload', async () => {
    const res = (await handler(
      {} as never,
      {} as never,
      () => undefined as never
    )) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(200);

    const parsed = JSON.parse(String(res.body ?? '{}')) as { ok?: boolean };
    expect(parsed.ok).toBe(true);
  });
});
