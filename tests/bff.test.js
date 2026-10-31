import test from 'node:test';
import assert from 'node:assert/strict';
import accessHandler from '../api/access.js';
import authHandler from '../api/auth.js';
import projectsHandler from '../api/projects.js';

const originalFetch = global.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  AICRATIVE_ACCESS_PASSWORD: process.env.AICRATIVE_ACCESS_PASSWORD,
  AICRATIVE_SESSION_SECRET: process.env.AICRATIVE_SESSION_SECRET,
};

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function req({ method = 'GET', body, cookie, origin = 'https://aicrative.test', query = {} } = {}) {
  return {
    method,
    body,
    query,
    headers: { host: 'aicrative.test', origin, cookie },
  };
}

function jsonResponse(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function configure() {
  process.env.SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key-never-returned';
  process.env.AICRATIVE_ACCESS_PASSWORD = 'shared-test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
}

function getAccessCookie(ip = '192.0.2.10') {
  const res = response();
  accessHandler({
    method: 'POST',
    body: { password: 'shared-test-password' },
    headers: { host: 'aicrative.test', origin: 'https://aicrative.test', 'x-forwarded-for': ip },
    socket: { remoteAddress: ip },
  }, res);
  assert.equal(res.statusCode, 200);
  return res.headers['Set-Cookie'].split(';')[0];
}

test('shared auth session exposes a workspace identity without email or tokens', async () => {
  configure();
  const cookie = getAccessCookie();
  const res = response();
  await authHandler(req({ cookie }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.user, {
    id: 'shared-workspace',
    user_metadata: { workspace: 'shared' },
  });
  assert.equal(JSON.stringify(res.body).includes('shared-test-password'), false);
  assert.equal(JSON.stringify(res.body).includes('service-role-test-key'), false);
});

test('shared auth returns unauthenticated without a valid access cookie', async () => {
  configure();
  const res = response();
  await authHandler(req(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { user: null });
});

test('shared auth logout clears the shared access cookie', async () => {
  configure();
  const res = response();
  await authHandler(req({ method: 'POST', body: { action: 'logout' }, cookie: getAccessCookie() }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
  assert.match(res.headers['Set-Cookie'], /HttpOnly/);
});

test('shared auth rejects cross-origin logout', async () => {
  configure();
  const res = response();
  await authHandler(req({
    method: 'POST',
    origin: 'https://attacker.test',
    body: { action: 'logout' },
    cookie: getAccessCookie('192.0.2.11'),
  }), res);
  assert.equal(res.statusCode, 403);
});

test('shared projects GET uses the server-only service role key', async () => {
  configure();
  const cookie = getAccessCookie('192.0.2.12');
  global.fetch = async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/shared_projects\?select=/);
    assert.equal(options.headers.apikey, 'service-role-test-key-never-returned');
    assert.equal(options.headers.Authorization, 'Bearer service-role-test-key-never-returned');
    return jsonResponse([{ id: 'p-1', title: 'Shared', project_data: { id: 'p-1' } }]);
  };
  const res = response();
  await projectsHandler(req({ cookie }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].id, 'p-1');
});

test('shared projects save contains no user ownership field', async () => {
  configure();
  const cookie = getAccessCookie('192.0.2.13');
  global.fetch = async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/shared_projects\?on_conflict=id$/);
    const payload = JSON.parse(options.body);
    assert.equal(payload.id, 'p-2');
    assert.equal(payload.title, 'Shared project');
    assert.deepEqual(payload.project_data, { id: 'p-2', title: 'Shared project' });
    assert.equal(Object.hasOwn(payload, 'user_id'), false);
    assert.match(options.headers.Prefer, /resolution=merge-duplicates/);
    return jsonResponse(null, 201);
  };
  const res = response();
  await projectsHandler(req({
    method: 'POST',
    cookie,
    body: { project: { id: 'p-2', title: 'Shared project' } },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
});

test('shared projects DELETE removes by validated project id', async () => {
  configure();
  const cookie = getAccessCookie('192.0.2.14');
  global.fetch = async (url, options) => {
    assert.match(String(url), /shared_projects\?id=eq\.p-3$/);
    assert.equal(options.method, 'DELETE');
    return jsonResponse(null, 204);
  };
  const res = response();
  await projectsHandler(req({ method: 'DELETE', cookie, query: { id: 'p-3' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
});

test('shared projects reject requests without a valid password cookie', async () => {
  configure();
  let called = false;
  global.fetch = async () => { called = true; return jsonResponse([]); };
  const res = response();
  await projectsHandler(req(), res);
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
});

test('shared projects reject cross-origin mutations', async () => {
  configure();
  const res = response();
  await projectsHandler(req({
    method: 'DELETE',
    origin: 'https://attacker.test',
    cookie: getAccessCookie('192.0.2.15'),
    query: { id: 'p-1' },
  }), res);
  assert.equal(res.statusCode, 403);
});

test('shared projects reject oversized project payloads before database access', async () => {
  configure();
  const cookie = getAccessCookie('192.0.2.16');
  let called = false;
  global.fetch = async () => { called = true; return jsonResponse(null, 201); };
  const res = response();
  await projectsHandler(req({
    method: 'POST',
    cookie,
    body: { project: { id: 'p-4', title: 'Too large', content: 'x'.repeat(900_001) } },
  }), res);
  assert.equal(res.statusCode, 413);
  assert.equal(called, false);
});

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
