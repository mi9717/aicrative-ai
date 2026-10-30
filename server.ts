import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Configuration strictly loaded from environment variables (NO hardcoded fallback secrets)
const APP_ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.SUPABASE_KEY?.trim();

// Server-side startup validation for required security configuration
function validateServerConfig() {
  const missing: string[] = [];
  if (!APP_ACCESS_PASSWORD) missing.push('APP_ACCESS_PASSWORD');
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_KEY) missing.push('SUPABASE_KEY');

  if (missing.length > 0) {
    console.error(
      `[SECURITY CONFIG ERROR] Environment variables wajib belum diatur: ${missing.join(', ')}.`
    );
    console.error(
      '[SECURITY CONFIG ERROR] Endpoint yang membutuhkan variabel ini akan mengembalikan HTTP 500 error konfigurasi. Nilai fallback tidak digunakan.'
    );
  } else {
    console.log('[SECURITY VERIFIED] Seluruh variabel environment wajib (APP_ACCESS_PASSWORD, SUPABASE_URL, SUPABASE_KEY) aktif.');
  }
}

validateServerConfig();

// Whitelist of approved AI models (strictly enforced on server)
const ALLOWED_MODELS = new Set([
  'qwen/qwen3.7-plus:free',
  'qwen/qwen3.7-max:free',
  'qwen/qwen3.8-max:free',
]);

app.use(express.json({ limit: '2mb' }));

// -------------------------------------------------------------
// RATE LIMITING & SECURITY DEFENSES (Brute-force protection)
// -------------------------------------------------------------
interface AttemptRecord {
  count: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 5 * 60 * 1000; // 5 minutes

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip: string): { allowed: boolean; waitMinutes?: number } {
  const record = loginAttempts.get(ip);
  const now = Date.now();
  if (record && record.lockedUntil > now) {
    const waitMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { allowed: false, waitMinutes };
  }
  return { allowed: true };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (record.lockedUntil <= now) {
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCK_TIME_MS;
      record.count = 0;
    }
    loginAttempts.set(ip, record);
  }
}

function resetFailedAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// Constant-time password comparison to prevent timing attacks
function safeCompare(input: string, expected?: string): boolean {
  if (!expected || typeof input !== 'string') return false;
  const a = Buffer.from(input, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a); // constant-time dummy op
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// -------------------------------------------------------------
// SESSION REGISTRY (Cryptographically random tokens)
// -------------------------------------------------------------
interface SessionRecord {
  token: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
}

const activeSessions = new Map<string, SessionRecord>();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup expired sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}, 30 * 60 * 1000);

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookies = parseCookies(req.headers['cookie']);
  if (cookies['aicrative_session']) {
    return cookies['aicrative_session'];
  }
  return null;
}

// Session authentication middleware
function requireSession(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Akses ditolak: Autentikasi sesi diperlukan sebelum mengakses fitur ini.',
    });
    return;
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) activeSessions.delete(token);
    res.status(401).json({
      error: 'Sesi telah kedaluwarsa atau tidak valid. Silakan masukkan password kembali.',
    });
    return;
  }

  next();
}

// GET /api/health (Unprotected health check)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// -------------------------------------------------------------
// AUTHENTICATION API ROUTES
// -------------------------------------------------------------

// POST /api/auth/login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);

  if (!rate.allowed) {
    res.status(429).json({
      error: `Terlalu banyak percobaan gagal. Silakan coba kembali dalam ${rate.waitMinutes} menit.`,
    });
    return;
  }

  // Validate that the server environment has configured APP_ACCESS_PASSWORD
  if (!APP_ACCESS_PASSWORD) {
    console.error('[AUTH CONFIG ERROR] APP_ACCESS_PASSWORD belum diatur di environment variable server.');
    res.status(500).json({
      error: 'Konfigurasi keamanan server belum lengkap: APP_ACCESS_PASSWORD belum diatur di environment server.',
    });
    return;
  }

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    recordFailedAttempt(ip);
    res.status(400).json({ error: 'Password wajib diisi.' });
    return;
  }

  const isValid = safeCompare(password.trim(), APP_ACCESS_PASSWORD);
  if (!isValid) {
    recordFailedAttempt(ip);
    res.status(401).json({ error: 'Password akses salah. Akses ditolak.' });
    return;
  }

  // Reset rate limiting on successful login
  resetFailedAttempts(ip);

  // Generate cryptographically secure token
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: SessionRecord = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
    ip,
  };
  activeSessions.set(token, session);

  // Set secure HttpOnly cookie
  res.setHeader(
    'Set-Cookie',
    `aicrative_session=${token}; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}; HttpOnly; SameSite=Lax`
  );

  res.json({
    success: true,
    message: 'Autentikasi berhasil.',
    token,
    expiresAt: session.expiresAt,
  });
});

// GET /api/auth/session
app.get('/api/auth/session', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ authenticated: false });
    return;
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) activeSessions.delete(token);
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    expiresAt: session.expiresAt,
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (token) {
    activeSessions.delete(token);
  }
  res.setHeader('Set-Cookie', 'aicrative_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  res.json({ success: true, message: 'Sesi berhasil diakhiri.' });
});

// -------------------------------------------------------------
// PROTECTED AI PROXY API ROUTES (ZERO SECRET EXPOSURE)
// -------------------------------------------------------------

// POST /api/ai/chat (Session Protected)
app.post('/api/ai/chat', requireSession, async (req: Request, res: Response) => {
  try {
    // Validate upstream configuration
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      const missingVars: string[] = [];
      if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
      if (!SUPABASE_KEY) missingVars.push('SUPABASE_KEY');
      console.error(`[AI PROXY CONFIG ERROR] Konfigurasi upstream belum lengkap: ${missingVars.join(', ')} belum diatur di environment.`);
      res.status(500).json({
        error: `Konfigurasi server backend belum lengkap: ${missingVars.join(', ')} belum diatur di environment variables server.`,
      });
      return;
    }

    const { model, messages, temperature, max_tokens } = req.body || {};

    // Strict model allowlist validation
    const chosenModel = model || 'qwen/qwen3.7-plus:free';
    if (!ALLOWED_MODELS.has(chosenModel)) {
      res.status(400).json({
        error: `Model "${chosenModel}" tidak diizinkan. Pilih salah satu model resmi: ${Array.from(ALLOWED_MODELS).join(', ')}.`,
      });
      return;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages wajib berupa array pesan percakapan.' });
      return;
    }

    // Call Supabase Edge Function securely from server-side environment
    const upstreamRes = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages,
        temperature: typeof temperature === 'number' ? Math.max(0, Math.min(1, temperature)) : 0.7,
        max_tokens: typeof max_tokens === 'number' ? Math.min(4000, max_tokens) : 4000,
      }),
    });

    const raw = await upstreamRes.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw.slice(0, 300) };
    }

    if (!upstreamRes.ok) {
      const errMsg =
        data?.message ||
        data?.error?.message ||
        data?.error ||
        `HTTP ${upstreamRes.status} dari backend AI`;
      res.status(upstreamRes.status).json({
        error: `Provider AI gagal memproses permintaan: ${errMsg}`,
      });
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({
        error: 'Respons AI diterima namun tidak memiliki konten teks yang valid.',
      });
      return;
    }

    // Return sanitized payload to client (NO upstream keys, tokens or internals)
    res.json({
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
        },
      ],
      usage: data?.usage || null,
      model: chosenModel,
    });
  } catch (error: any) {
    res.status(500).json({
      error: `Kegagalan komunikasi server: ${error?.message || String(error)}`,
    });
  }
});

// GET /api/ai/status (Session Protected)
app.get('/api/ai/status', requireSession, async (_req: Request, res: Response) => {
  const start = performance.now();
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      const missingVars: string[] = [];
      if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
      if (!SUPABASE_KEY) missingVars.push('SUPABASE_KEY');
      res.status(500).json({
        connected: false,
        latencyMs: 0,
        error: `Konfigurasi server backend belum lengkap: ${missingVars.join(', ')} belum diatur di environment variables server.`,
      });
      return;
    }

    const pingRes = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.7-plus:free',
        messages: [{ role: 'user', content: 'Ping status' }],
        temperature: 0.1,
        max_tokens: 10,
      }),
    });

    const latencyMs = Math.round(performance.now() - start);
    if (!pingRes.ok) {
      res.status(502).json({
        connected: false,
        latencyMs,
        status: `Upstream HTTP ${pingRes.status}`,
      });
      return;
    }

    res.json({
      connected: true,
      latencyMs,
      model: 'qwen/qwen3.7-plus:free',
      status: 'operational',
    });
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - start);
    res.status(500).json({
      connected: false,
      latencyMs,
      error: 'Backend AI tidak dapat dihubungi.',
    });
  }
});

// -------------------------------------------------------------
// VITE SPA & STATIC SERVING
// -------------------------------------------------------------
async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AICRATIVE SERVER] Running at http://0.0.0.0:${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

setupServer();
