import { clearSharedAccessCookie, isSharedAccessAuthorized } from './access.js';

function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function isSameOrigin(req) {
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

export default async function handler(req, res) {
  setNoStoreHeaders(res);

  if (req.method === 'GET') {
    if (!isSharedAccessAuthorized(req)) {
      return res.status(200).json({ user: null });
    }
    return res.status(200).json({
      user: { id: 'shared-workspace', user_metadata: { workspace: 'shared' } },
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Method not allowed.' });
  }
  if (!isSameOrigin(req)) {
    return res.status(403).json({ message: 'Permintaan lintas-origin ditolak.' });
  }
  if (req.body?.action !== 'logout') {
    return res.status(400).json({ message: 'AICRATIVE menggunakan satu password akses bersama. Tidak ada registrasi akun.' });
  }

  clearSharedAccessCookie(res);
  return res.status(200).json({ success: true });
}
