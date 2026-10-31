import test from 'node:test';
import assert from 'node:assert/strict';
import authHandler from '../api/auth.js';
import projectsHandler from '../api/projects.js';

const originalFetch = global.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  AICRATIVE_SESSION_SECRET: process.env.AICRATIVE_SESSION_SECRET,
};

const session = {
  access_token: 'access-token-secret',
  refresh_token: 'refresh-token-secret',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'user-123', email: 'creator@example.com', user_metadata: { display_name: 'Creator' } },
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
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_test';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
}

test('BFF auth login stores encrypted HttpOnly cookie and never returns tokens', async () => {
  configure();
  global.fetch = async url => {
    assert.match(String(url), /auth\/v1\/token\?grant_type=password$/);
    return jsonResponse(session);
  };
  const res = response();
  await authHandler(req({ method: 'POST', body: { action: 'login', email: 'creator@example.com', password: 'pass' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.id, 'user-123');
  assert.equal(JSON.stringify(res.body).includes('access-token-secret'), false);
  assert.equal(JSON.stringify(res.body).includes('refresh-token-secret'), false);
  assert.match(res.headers['Set-Cookie'], /^aicrative_session=/);
  assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  assert.match(res.headers['Set-Cookie'], /Secure/);
  assert.match(res.headers['Set-Cookie'], /SameSite=Lax/);
});

test('BFF auth rejects cross-origin login requests', async () => {
  configure();
  const res = response();
  await authHandler(req({
    method: 'POST',
    origin: 'https://attacker.test',
    body: { action: 'login', email: 'creator@example.com', password: 'pass' },
  }), res);
  assert.equal(res.statusCode, 403);
});

test('BFF auth session returns verified user without exposing session tokens', async () => {
  configure();
  let cookie;
  global.fetch = async url => {
    if (String(url).endsWith('/auth/v1/token?grant_type=password')) return jsonResponse(session);
    if (String(url).endsWith('/auth/v1/user')) return jsonResponse(session.user);
    throw new Error('Unexpected upstream request: ' + url);
  };
  const login = response();
  await authHandler(req({ method: 'POST', body: { action: 'login', email: 'creator@example.com', password: 'pass' } }), login);
  cookie = login.headers['Set-Cookie'].split(';')[0];

  const res = response();
  await authHandler(req({ cookie }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.id, 'user-123');
  assert.equal(JSON.stringify(res.body).includes('access-token-secret'), false);
});

test('BFF projects derives user_id from encrypted session, not client payload', async () => {
  configure();
  global.fetch = async url => {
    if (String(url).endsWith('/auth/v1/token?grant_type=password')) return jsonResponse(session);
    if (String(url).endsWith('/rest/v1/projects?on_conflict=id')) {
      const options = global.__lastFetchOptions;
      const payload = JSON.parse(options.body);
      assert.equal(payload.user_id, 'user-123');
      assert.notEqual(payload.user_id, 'attacker-controlled-user');
      return jsonResponse(null, 201);
    }
    throw new Error('Unexpected upstream request: ' + url);
  };
  const wrappedFetch = global.fetch;
  global.fetch = async (url, options) => {
    global.__lastFetchOptions = options;
    return wrappedFetch(url, options);
  };

  const login = response();
  await authHandler(req({ method: 'POST', body: { action: 'login', email: 'creator@example.com', password: 'pass' } }), login);
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const res = response();
  await projectsHandler(req({
    method: 'POST',
    cookie,
    body: { project: { id: 'proj-1', title: 'Test', user_id: 'attacker-controlled-user' } },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
});

test('BFF projects rejects cross-origin mutations', async () => {
  configure();
  const res = response();
  await projectsHandler(req({
    method: 'DELETE',
    origin: 'https://attacker.test',
    query: { id: 'proj-1' },
  }), res);
  assert.equal(res.statusCode, 403);
});

test('BFF projects requires an authenticated encrypted session', async () => {
  configure();
  const res = response();
  await projectsHandler(req(), res);
  assert.equal(res.statusCode, 401);
});

test('BFF auth clears an invalid or absent session without returning a token', async () => {
  configure();
  const res = response();
  await authHandler(req(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { user: null });
});

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete global.__lastFetchOptions;
});
