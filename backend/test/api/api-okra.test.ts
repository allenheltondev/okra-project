import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fuzzCoordinates } from '../../src/services/privacy-fuzzing.mjs';

// ─── Mocks ──────────────────────────────────────────────────────────────────

let queryResponses: Record<string, any>;

const mockClient = {
  connect: vi.fn(),
  query: vi.fn((text: string, _params?: any[]) => {
    for (const [pattern, response] of Object.entries(queryResponses)) {
      if (text.includes(pattern)) {
        if (typeof response === 'function') return response(text, _params);
        return response;
      }
    }
    return { rows: [], rowCount: 0 };
  }),
  end: vi.fn(),
};

vi.mock('../../scripts/db-client.mjs', () => ({
  createDbClient: vi.fn(() => mockClient),
}));

import { handler } from '../../src/handlers/api.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRestApiEvent(
  path: string,
  method = 'GET',
  options: {
    queryStringParameters?: Record<string, string> | null;
  } = {}
) {
  return {
    resource: '/{proxy+}',
    path,
    httpMethod: method,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: options.queryStringParameters ?? null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'req-okra',
      path,
      stage: 'api',
      identity: { sourceIp: '127.0.0.1', userAgent: 'vitest' },
    },
    body: null,
    isBase64Encoded: false,
  };
}

function parseRes(res: any) {
  return { statusCode: res.statusCode, body: JSON.parse(res.body) };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const UUID_2 = '550e8400-e29b-41d4-a716-446655440002';

function makeApprovedRow(overrides: Record<string, any> = {}) {
  return {
    id: UUID_1,
    contributor_name: 'Alice',
    story_text: 'Found okra here',
    privacy_mode: 'exact',
    display_lat: 34.05,
    display_lng: -118.24,
    created_at: new Date('2024-01-15T10:00:00Z'),
    created_at_raw: '2024-01-15 10:00:00.000000+00',
    ...overrides,
  };
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  process.env.MEDIA_CDN_DOMAIN = 'dtest123.cloudfront.net';
  queryResponses = {};
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.MEDIA_CDN_DOMAIN;
});

// ─── Helpers for setting up mocks ───────────────────────────────────────────

function setupOkraMocks(submissionRows: any[] = [], photoRows: any[] = []) {
  queryResponses = {
    'FROM submissions': { rows: submissionRows, rowCount: submissionRows.length },
    'FROM submission_photos': { rows: photoRows, rowCount: photoRows.length },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Default limit
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — default limit', () => {
  it('defaults to limit=20 when no limit param provided', async () => {
    setupOkraMocks();
    const res = await handler(makeRestApiEvent('/okra'));
    const { statusCode, body } = parseRes(res);
    expect(statusCode).toBe(200);
    expect(body).toEqual({ data: [], cursor: null });

    // Verify the query was called with limit+1 = 21
    const queryCall = mockClient.query.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('FROM submissions')
    );
    expect(queryCall).toBeDefined();
    expect(queryCall![1]).toContain(21);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Null-island exclusion
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — null-island exclusion', () => {
  it('query includes NOT (display_lat = 0 AND display_lng = 0) filter', async () => {
    setupOkraMocks();
    await handler(makeRestApiEvent('/okra'));

    const queryCall = mockClient.query.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('FROM submissions')
    );
    expect(queryCall).toBeDefined();
    expect(queryCall![0]).toContain('NOT (s.display_lat = 0 AND s.display_lng = 0)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Privacy fuzzing
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — privacy fuzzing', () => {
  it('returns original coordinates for exact mode', async () => {
    const row = makeApprovedRow({ privacy_mode: 'exact', display_lat: 34.05, display_lng: -118.24 });
    setupOkraMocks([row]);
    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    expect(body.data).toHaveLength(1);
    expect(body.data[0].display_lat).toBe(34.05);
    expect(body.data[0].display_lng).toBe(-118.24);
  });

  it('applies fuzzing for nearby mode', async () => {
    const row = makeApprovedRow({ privacy_mode: 'nearby', display_lat: 34.05, display_lng: -118.24 });
    setupOkraMocks([row]);
    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    const item = body.data[0];

    // Fuzzed coordinates should differ from original (unless astronomically unlikely)
    const fuzzed = fuzzCoordinates(UUID_1, 34.05, -118.24, 'nearby');
    expect(item.display_lat).toBe(fuzzed.lat);
    expect(item.display_lng).toBe(fuzzed.lng);

    // Should be within 0.005 degree radius
    const dist = Math.sqrt((item.display_lat - 34.05) ** 2 + (item.display_lng + 118.24) ** 2);
    expect(dist).toBeLessThanOrEqual(0.005);
  });

  it('applies fuzzing for neighborhood mode', async () => {
    const row = makeApprovedRow({ privacy_mode: 'neighborhood', display_lat: 40.0, display_lng: -74.0 });
    setupOkraMocks([row]);
    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    const item = body.data[0];

    const fuzzed = fuzzCoordinates(UUID_1, 40.0, -74.0, 'neighborhood');
    expect(item.display_lat).toBe(fuzzed.lat);
    expect(item.display_lng).toBe(fuzzed.lng);

    const dist = Math.sqrt((item.display_lat - 40.0) ** 2 + (item.display_lng + 74.0) ** 2);
    expect(dist).toBeLessThanOrEqual(0.02);
  });

  it('applies fuzzing for city mode', async () => {
    const row = makeApprovedRow({ privacy_mode: 'city', display_lat: 51.5, display_lng: -0.12 });
    setupOkraMocks([row]);
    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    const item = body.data[0];

    const fuzzed = fuzzCoordinates(UUID_1, 51.5, -0.12, 'city');
    expect(item.display_lat).toBe(fuzzed.lat);
    expect(item.display_lng).toBe(fuzzed.lng);

    const dist = Math.sqrt((item.display_lat - 51.5) ** 2 + (item.display_lng + 0.12) ** 2);
    expect(dist).toBeLessThanOrEqual(0.05);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — CloudFront URL construction
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — CloudFront URL construction', () => {
  it('constructs CloudFront URLs with correct domain and path', async () => {
    const row = makeApprovedRow();
    const photoRows = [
      { submission_id: UUID_1, thumbnail_s3_key: 'submissions/abc/thumb.webp' },
      { submission_id: UUID_1, thumbnail_s3_key: 'submissions/def/thumb.webp' },
    ];
    setupOkraMocks([row], photoRows);

    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    expect(body.data[0].photo_urls).toEqual([
      'https://dtest123.cloudfront.net/submissions/abc/thumb.webp',
      'https://dtest123.cloudfront.net/submissions/def/thumb.webp',
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Empty photo_urls
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — empty photo_urls', () => {
  it('returns empty photo_urls when submission has no ready photos', async () => {
    const row = makeApprovedRow();
    setupOkraMocks([row], []);

    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    expect(body.data[0].photo_urls).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Graceful degradation when MEDIA_CDN_DOMAIN not set
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — MEDIA_CDN_DOMAIN not set', () => {
  it('returns empty photo_urls and logs warning when MEDIA_CDN_DOMAIN is not set', async () => {
    delete process.env.MEDIA_CDN_DOMAIN;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const row = makeApprovedRow();
    const photoRows = [
      { submission_id: UUID_1, thumbnail_s3_key: 'submissions/abc/thumb.webp' },
    ];
    setupOkraMocks([row], photoRows);

    const { statusCode, body } = parseRes(await handler(makeRestApiEvent('/okra')));
    expect(statusCode).toBe(200);
    expect(body.data[0].photo_urls).toEqual([]);

    // Verify warning was logged
    expect(consoleSpy).toHaveBeenCalled();
    const loggedMsg = consoleSpy.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('MEDIA_CDN_DOMAIN')
    );
    expect(loggedMsg).toBeDefined();

    consoleSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Error logging on database failure
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — database error handling', () => {
  it('returns 500 INTERNAL_ERROR and logs error on database failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    queryResponses = {
      'FROM submissions': () => { throw new Error('Connection refused: ECONNREFUSED'); },
    };

    const { statusCode, body } = parseRes(await handler(makeRestApiEvent('/okra')));
    expect(statusCode).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    // Should not leak internal error details
    expect(body.error.message).not.toContain('ECONNREFUSED');

    // Verify error was logged with structured JSON
    const errorLog = consoleSpy.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('GET /okra')
    );
    expect(errorLog).toBeDefined();
    const parsed = JSON.parse(errorLog![0]);
    expect(parsed.level).toBe('error');
    expect(parsed.endpoint).toBe('GET /okra');
    expect(parsed.message).toContain('ECONNREFUSED');

    consoleSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Limit validation
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — limit validation', () => {
  it('returns INVALID_LIMIT for non-numeric limit', async () => {
    const { statusCode, body } = parseRes(
      await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { limit: 'abc' } }))
    );
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('returns INVALID_LIMIT for zero limit', async () => {
    const { statusCode, body } = parseRes(
      await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { limit: '0' } }))
    );
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('returns INVALID_LIMIT for negative limit', async () => {
    const { statusCode, body } = parseRes(
      await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { limit: '-5' } }))
    );
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('returns INVALID_LIMIT for decimal limit', async () => {
    const { statusCode, body } = parseRes(
      await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { limit: '3.7' } }))
    );
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('clamps limit above 100 to 100', async () => {
    setupOkraMocks();
    await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { limit: '200' } }));

    const queryCall = mockClient.query.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('FROM submissions')
    );
    expect(queryCall).toBeDefined();
    // limit + 1 = 101
    expect(queryCall![1]).toContain(101);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Cursor validation
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — cursor validation', () => {
  it('returns INVALID_CURSOR for malformed cursor', async () => {
    const { statusCode, body } = parseRes(
      await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { cursor: 'not-valid-base64' } }))
    );
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_CURSOR');
  });

  it('returns INVALID_CURSOR for base64 with missing fields', async () => {
    const badCursor = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');
    const { statusCode, body } = parseRes(
      await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { cursor: badCursor } }))
    );
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_CURSOR');
  });

  it('returns INVALID_CURSOR for cursor with invalid UUID', async () => {
    const badCursor = Buffer.from(JSON.stringify({
      created_at: '2024-01-15 10:00:00.000000+00',
      id: 'not-a-uuid',
    })).toString('base64url');
    const { statusCode, body } = parseRes(
      await handler(makeRestApiEvent('/okra', 'GET', { queryStringParameters: { cursor: badCursor } }))
    );
    expect(statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_CURSOR');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /okra — Response shape
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /okra — response shape', () => {
  it('includes required fields and excludes sensitive fields', async () => {
    const row = makeApprovedRow();
    setupOkraMocks([row]);

    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    expect(body.data).toHaveLength(1);
    const item = body.data[0];

    // Required fields present
    for (const field of ['id', 'contributor_name', 'story_text', 'privacy_mode', 'display_lat', 'display_lng', 'created_at', 'photo_urls']) {
      expect(item).toHaveProperty(field);
    }

    // Sensitive fields excluded
    for (const field of ['contributor_email', 'raw_location_text', 'geocode_lat', 'geocode_lng', 'reviewed_by', 'reviewed_at', 'review_notes']) {
      expect(item).not.toHaveProperty(field);
    }
  });

  it('returns { data: [], cursor: null } for empty result set', async () => {
    setupOkraMocks([], []);
    const { body } = parseRes(await handler(makeRestApiEvent('/okra')));
    expect(body.data).toEqual([]);
    expect(body.cursor).toBeNull();
  });
});
