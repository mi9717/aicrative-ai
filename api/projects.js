import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'aicrative_access';
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

function digest(value) {
  return createHash('sha256').update(value).digest();
}

function isAuthorized(req, password) {
  const item = (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(COOKIE_NAME + '='));
  if (!item) return false;

  const parts = item.slice(COOKIE_NAME.length + 1).split('.');
  if (parts.length !== 2) return false;
  const issuedAt = Number(parts[0]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 60 || now - issuedAt > COOKIE_TTL_SECONDS) return false;

  const expected = createHmac('sha256', password)
    .update('aicrative-shared-access-v2:' + issuedAt)
    .digest('hex');
  return timingSafeEqual(digest(parts[1]), digest(expected));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function send(res, status, payload) {
  return res.status(status).json(payload);
}

async function supabaseRequest(path, method = 'GET', body) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Konfigurasi penyimpanan cloud belum lengkap di Vercel.');
  }

  const response = await fetch(url + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { Prefer: 'resolution=merge-duplicates,return=minimal' } : { Prefer: 'return=representation' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('AICRATIVE shared project storage error:', response.status, detail);
    throw new Error('Penyimpanan proyek cloud gagal diproses.');
  }
  if (response.status === 204) return null;
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');

  const password = process.env.AICRATIVE_ACCESS_PASSWORD;
  if (!password) return send(res, 503, { message: 'Password akses belum dikonfigurasi di Vercel.' });
  if (!isAuthorized(req, password)) return send(res, 401, { message: 'Sesi akses berakhir. Masukkan kembali password AICRATIVE.' });

  try {
    if (req.method === 'GET') {
      const rows = await supabaseRequest('shared_projects?select=id,title,project_data,created_at,updated_at&order=updated_at.desc');
      const projects = (rows || []).map(row => ({
        ...row.project_data,
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      return send(res, 200, projects);
    }

    if (req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, { message: 'Permintaan lintas-origin ditolak.' });
      const project = req.body?.project;
      if (!project || typeof project !== 'object' || Array.isArray(project)) {
        return send(res, 400, { message: 'Data proyek tidak valid.' });
      }
      if (typeof project.id !== 'string' || !project.id.trim() || project.id.length > 160) {
        return send(res, 400, { message: 'ID proyek tidak valid.' });
      }
      const serialized = JSON.stringify(project);
      if (serialized.length > 1_500_000) return send(res, 413, { message: 'Ukuran proyek terlalu besar.' });

      await supabaseRequest('shared_projects?on_conflict=id', 'POST', {
        id: project.id,
        title: typeof project.title === 'string' ? project.title.slice(0, 240) : 'Untitled project',
        project_data: project,
        updated_at: new Date().toISOString(),
      });
      return send(res, 200, { saved: true });
    }

    if (req.method === 'DELETE') {
      if (!sameOrigin(req)) return send(res, 403, { message: 'Permintaan lintas-origin ditolak.' });
      const id = typeof req.body?.id === 'string' ? req.body.id : '';
      if (!id || id.length > 160) return send(res, 400, { message: 'ID proyek tidak valid.' });
      await supabaseRequest('shared_projects?id=eq.' + encodeURIComponent(id), 'DELETE');
      return send(res, 200, { deleted: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { message: 'Method not allowed.' });
  } catch (error) {
    console.error('AICRATIVE project API error:', error);
    return send(res, 500, { message: error instanceof Error ? error.message : 'Terjadi kesalahan server.' });
  }
}
