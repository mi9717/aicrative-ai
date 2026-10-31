import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const COOKIE_NAME = 'aicrative_session';
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

function getConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || '';
  const secret = process.env.AICRATIVE_SESSION_SECRET || '';
  if (!url || !key || secret.length < 32) {
    throw new Error('Server auth belum dikonfigurasi. Periksa SUPABASE_URL, SUPABASE_ANON_KEY, dan AICRATIVE_SESSION_SECRET.');
  }
  return { url, key, encryptionKey: createHash('sha256').update(secret).digest() };
}

export function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function isSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host && (parsed.protocol === 'https:' || parsed.hostname === 'localhost');
  } catch {
    return false;
  }
}

function readCookie(req) {
  const cookies = (req.headers.cookie || '').split(';').map(part => part.trim());
  const item = cookies.find(part => part.startsWith(COOKIE_NAME + '='));
  return item ? item.slice(COOKIE_NAME.length + 1) : null;
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', COOKIE_NAME + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

function writeSessionCookie(res, session) {
  const { encryptionKey } = getConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const value = [iv, tag, encrypted].map(part => part.toString('base64url')).join('.');
  res.setHeader('Set-Cookie', COOKIE_NAME + '=' + value + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + COOKIE_TTL_SECONDS);
}

function decodeSession(req) {
  const value = readCookie(req);
  if (!value) return null;
  try {
    const { encryptionKey } = getConfig();
    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length > 16_384) return null;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(tag);
    const raw = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const session = JSON.parse(raw);
    if (!session.access_token || !session.refresh_token || !session.user?.id || !Number.isFinite(session.expires_at)) return null;
    return session;
  } catch {
    return null;
  }
}

async function supabaseRequest(path, { method = 'GET', body, token } = {}) {
  const { url, key } = getConfig();
  const response = await fetch(url + '/auth/v1/' + path, {
    method,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.msg || data.message || data.error_description || data.error;
    const error = new Error(message || 'Autentikasi Supabase gagal.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function createSupabaseSession(path, body) {
  return supabaseRequest(path, { method: 'POST', body });
}

export async function getValidSession(req, res, { verifyUser = false } = {}) {
  let session = decodeSession(req);
  if (!session) return null;

  try {
    if (session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
      const refreshed = await supabaseRequest('token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: session.refresh_token },
      });
      session = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: refreshed.expires_at || Math.floor(Date.now() / 1000) + (refreshed.expires_in || 3600),
        user: refreshed.user,
      };
      writeSessionCookie(res, session);
    }

    if (verifyUser) {
      const user = await supabaseRequest('user', { token: session.access_token });
      session.user = user;
    }
    return session;
  } catch {
    clearSessionCookie(res);
    return null;
  }
}

export function setSessionCookie(res, session) {
  const normalized = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
    user: session.user,
  };
  writeSessionCookie(res, normalized);
}

export async function revokeSupabaseSession(session) {
  if (!session?.access_token) return;
  try {
    await supabaseRequest('logout', { method: 'POST', token: session.access_token });
  } catch {
    // Local cookie is cleared regardless of remote revocation outcome.
  }
}

export async function supabaseRest(path, { method = 'GET', body, token, prefer } = {}) {
  const { url, key } = getConfig();
  const response = await fetch(url + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.details || 'Gagal mengakses penyimpanan proyek.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
