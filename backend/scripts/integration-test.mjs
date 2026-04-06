const BASE_URL = process.env.API_BASE_URL;

if (!BASE_URL) {
  console.error('API_BASE_URL is required, e.g. https://abc.execute-api.us-east-1.amazonaws.com/api');
  process.exit(1);
}

const color = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const symbol = {
  pass: `${color.green}✓${color.reset}`,
  fail: `${color.red}✗${color.reset}`,
  step: `${color.cyan}→${color.reset}`
};

function normalizeBase(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

const baseUrl = normalizeBase(BASE_URL);

async function request(path, options = {}) {
  const method = options.method ?? 'GET';
  console.log(`${symbol.step} ${color.cyan}${method} ${path}${color.reset}`);

  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let json;

  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  console.log(`${color.dim}  status: ${res.status}${color.reset}`);

  return {
    status: res.status,
    headers: res.headers,
    text,
    json
  };
}

function assertCheck(condition, message) {
  if (!condition) {
    console.error(`  ${symbol.fail} ${message}`);
    throw new Error(message);
  }

  console.log(`  ${symbol.pass} ${message}`);
}

async function testHealth() {
  const res = await request('/health');
  assertCheck(res.status === 200, `GET /health returns 200 (got ${res.status})`);
  assertCheck(res.json?.ok === true, 'GET /health returns ok=true');
  assertCheck(typeof res.json?.service === 'string', 'GET /health returns service string');
}

async function testVersion() {
  const res = await request('/version');
  assertCheck(res.status === 200, `GET /version returns 200 (got ${res.status})`);
  assertCheck(res.json?.ok === true, 'GET /version returns ok=true');
  assertCheck(typeof res.json?.version === 'string', 'GET /version returns version string');
}

async function testSubmissionValidation() {
  const res = await request('/submissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ contributorName: 'missing required fields' })
  });

  assertCheck(res.status === 422, `POST /submissions invalid payload returns 422 (got ${res.status})`);
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

  assertCheck(first.status === 201, `POST /submissions valid payload returns 201 (got ${first.status})`);
  assertCheck(typeof first.json?.submissionId === 'string', 'POST /submissions returns submissionId string');
  assertCheck(first.json?.status === 'pending_review', 'POST /submissions returns status=pending_review');

  const second = await request('/submissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  assertCheck(second.status === 201, `POST /submissions idempotent replay returns 201 (got ${second.status})`);
  assertCheck(
    second.json?.submissionId === first.json?.submissionId,
    'Idempotent replay returns the same submissionId'
  );
}

async function run() {
  console.log(`${color.yellow}Running integration tests against ${baseUrl}${color.reset}`);

  await testHealth();
  await testVersion();
  await testSubmissionValidation();
  await testSubmissionCreateAndIdempotency();

  console.log(`${color.green}All integration tests passed.${color.reset}`);
}

run().catch((error) => {
  console.error(`${color.red}Integration tests failed:${color.reset} ${error.message}`);
  process.exit(1);
});
