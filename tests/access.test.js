import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/access.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request({ method = 'GET', body, cookie, ip = '192.0.2.1', origin = 'https://aicrative.test' } = {}) {
  return {
    method,
    body,
    headers: {
      cookie,
      origin,
      host: 'aicrative.test',
      'x-forwarded-for': ip,
    },
    socket: { remoteAddress: ip },
  };
}

test('returns 503 when shared access password is not configured', () => {
  const previous = process.env.AICRATIVE_ACCESS_PASSWORD;
  delete process.env.AICRATIVE_ACCESS_PASSWORD;
  const res = createResponse();
  handler(request(), res);
  assert.equal(res.statusCode, 503);
  if (previous !== undefined) process.env.AICRATIVE_ACCESS_PASSWORD = previous;
});

test('rejects an incorrect password and does not issue a cookie', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const res = createResponse();
  handler(request({ method: 'POST', body: { password: 'wrong' } }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('issues a signed, HttpOnly, secure, SameSite cookie for valid password', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const res = createResponse();
  handler(request({ method: 'POST', body: { password: 'test-password' }, ip: '192.0.2.2' }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  assert.match(res.headers['Set-Cookie'], /Secure/);
  assert.match(res.headers['Set-Cookie'], /SameSite=Strict/);
  assert.match(res.headers['Set-Cookie'], /Max-Age=2592000/);
});

test('accepts a valid cookie and rejects a modified cookie', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const login = createResponse();
  handler(request({ method: 'POST', body: { password: 'test-password' }, ip: '192.0.2.3' }), login);
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const valid = createResponse();
  handler(request({ cookie }), valid);
  assert.equal(valid.statusCode, 200);
  const invalid = createResponse();
  handler(request({ cookie: cookie + 'tampered' }), invalid);
  assert.equal(invalid.statusCode, 401);
});

test('rejects password submissions without an Origin header', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const req = request({ method: 'POST', body: { password: 'test-password' }, ip: '192.0.2.6' });
  delete req.headers.origin;
  const res = createResponse();
  handler(req, res);
  assert.equal(res.statusCode, 403);
});

test('rejects oversized password input', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const res = createResponse();
  handler(request({ method: 'POST', body: { password: 'x'.repeat(1025) }, ip: '192.0.2.7' }), res);
  assert.equal(res.statusCode, 400);
});

test('rejects cross-origin password submissions', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const res = createResponse();
  handler(request({ method: 'POST', body: { password: 'test-password' }, origin: 'https://attacker.test', ip: '192.0.2.4' }), res);
  assert.equal(res.statusCode, 403);
});

test('rate-limits repeated failed password attempts per client', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const ip = '192.0.2.5';
  for (let i = 0; i < 10; i += 1) {
    const res = createResponse();
    handler(request({ method: 'POST', body: { password: 'wrong' }, ip }), res);
    assert.equal(res.statusCode, 401);
  }
  const limited = createResponse();
  handler(request({ method: 'POST', body: { password: 'test-password' }, ip }), limited);
  assert.equal(limited.statusCode, 429);
  assert.ok(limited.headers['Retry-After']);
});

test('rejects unsupported methods', () => {
  process.env.AICRATIVE_ACCESS_PASSWORD = 'test-password';
  process.env.AICRATIVE_SESSION_SECRET = 'test-session-secret-that-is-long-enough-32';
  const res = createResponse();
  handler(request({ method: 'DELETE' }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET, POST');
});
