import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'aicrative_access';
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const attemptsByClient = new Map();

function digest(value) {
  return createHash('sha256').update(value).digest();
}

function signature(password, issuedAt) {
  return createHmac('sha256', password)
    .update('aicrative-shared-access-v2:' + issuedAt)
    .digest('hex');
}

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const address = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
  return address.slice(0, 128);
}

function isRateLimited(clientKey, now) {
  const record = attemptsByClient.get(clientKey);
  if (!record || now - record.startedAt >= RATE_LIMIT_WINDOW_MS) {
    attemptsByClient.set(clientKey, { startedAt: now, count: 0 });
    return false;
  }
  return record.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

function recordFailedAttempt(clientKey, now) {
  const record = attemptsByClient.get(clientKey);
  if (!record || now - record.startedAt >= RATE_LIMIT_WINDOW_MS) {
    attemptsByClient.set(clientKey, { startedAt: now, count: 1 });
  } else {
    record.count += 1;
  }
}

function clearAttempts(clientKey) {
  attemptsByClient.delete(clientKey);
}

function validCookie(req, password, nowSeconds = Math.floor(Date.now() / 1000)) {
  const cookies = (req.headers.cookie || '').split(';').map(value => value.trim());
  const item = cookies.find(value => value.startsWith(COOKIE_NAME + '='));
  if (!item) return false;

  const supplied = item.slice(COOKIE_NAME.length + 1).split('.');
  if (supplied.length !== 2) return false;

  const issuedAt = Number(supplied[0]);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > nowSeconds + 60 || nowSeconds - issuedAt > COOKIE_TTL_SECONDS) {
    return false;
  }

  const expected = signature(password, issuedAt);
  const actualDigest = digest(supplied[1]);
  const expectedDigest = digest(expected);
  return timingSafeEqual(actualDigest, expectedDigest);
}

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default function handler(req, res) {
  setSecurityHeaders(res);
  const password = process.env.AICRATIVE_ACCESS_PASSWORD;
  if (!password) {
    return res.status(503).json({ message: 'Password akses belum dikonfigurasi di Vercel.' });
  }

  if (req.method === 'GET') {
    return validCookie(req, password)
      ? res.status(200).json({ authorized: true })
      : res.status(401).json({ authorized: false });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ message: 'Permintaan lintas-origin ditolak.' });
  }

  const clientKey = getClientKey(req);
  const now = Date.now();
  if (isRateLimited(clientKey, now)) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    return res.status(429).json({ message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
  }

  const supplied = typeof req.body?.password === 'string' ? req.body.password : '';
  const matches = timingSafeEqual(digest(supplied), digest(password));
  if (!matches) {
    recordFailedAttempt(clientKey, now);
    return res.status(401).json({ message: 'Password akses salah. Coba lagi.' });
  }

  clearAttempts(clientKey);
  const issuedAt = Math.floor(now / 1000);
  const cookieValue = issuedAt + '.' + signature(password, issuedAt);
  res.setHeader(
    'Set-Cookie',
    COOKIE_NAME + '=' + cookieValue + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=' + COOKIE_TTL_SECONDS
  );
  return res.status(200).json({ authorized: true });
}
