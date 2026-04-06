const BASE_URL = process.env.API_BASE_URL;

if (!BASE_URL) {
  console.error('API_BASE_URL is required, e.g. https://abc.execute-api.us-east-1.amazonaws.com/api');
  process.exit(1);
}

function normalizeBase(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

const baseUrl = normalizeBase(BASE_URL);

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let json;

  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  return {
    status: res.status,
    headers: res.headers,
    text,
    json
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testHealth() {
  const res = await request('/health');
  assert(res.status === 200, `GET /health expected 200, got ${res.status}`);
  assert(res.json?.ok === true, 'GET /health expected ok=true');
  assert(typeof res.json?.service === 'string', 'GET /health expected service string');
}

async function testVersion() {
  const res = await request('/version');
  assert(res.status === 200, `GET /version expected 200, got ${res.status}`);
  assert(res.json?.ok === true, 'GET /version expected ok=true');
  assert(typeof res.json?.version === 'string', 'GET /version expected version string');
}

async function testSubmissionValidation() {
  const res = await request('/submissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ contributorName: 'missing required fields' })
  });

  assert(res.status === 422, `POST /submissions invalid payload expected 422, got ${res.status}`);
}

async function testSubmissionCreateAndIdempotency() {
  const idempotencyKey = `it-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const payload = {
    contributorName: 'Integration Test Grower',
    contributorEmail: 'integration@example.com',
    storyText: 'Testing submission create endpoint',
    rawLocationText: 'Austin, TX',
    privacyMode: 'city',
    displayLat: 30.2672,
    displayLng: -97.7431
  };

  const first = await request('/submissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  assert(first.status === 201, `POST /submissions valid payload expected 201, got ${first.status}`);
  assert(typeof first.json?.submissionId === 'string', 'POST /submissions expected submissionId string');
  assert(first.json?.status === 'pending_review', 'POST /submissions expected status=pending_review');

  const second = await request('/submissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  assert(second.status === 201, `POST /submissions idempotent replay expected 201, got ${second.status}`);
  assert(
    second.json?.submissionId === first.json?.submissionId,
    'Idempotent replay expected same submissionId as first request'
  );
}

async function run() {
  console.log(`Running integration tests against ${baseUrl}`);

  await testHealth();
  console.log('✓ GET /health');

  await testVersion();
  console.log('✓ GET /version');

  await testSubmissionValidation();
  console.log('✓ POST /submissions validation (422)');

  await testSubmissionCreateAndIdempotency();
  console.log('✓ POST /submissions create + idempotency');

  console.log('All integration tests passed.');
}

run().catch((error) => {
  console.error('Integration tests failed:', error.message);
  process.exit(1);
});
