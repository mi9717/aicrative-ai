import { createHmac, timingSafeEqual } from 'node:crypto';

function signature(password) {
  return createHmac('sha256', password).update('aicrative-shared-access-v1').digest('hex');
}
function validCookie(req, password) {
  const cookies = (req.headers.cookie || '').split(';').map(value => value.trim());
  const item = cookies.find(value => value.startsWith('aicrative_access='));
  if (!item) return false;
  const supplied = item.slice('aicrative_access='.length);
  const expected = signature(password);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default function handler(req, res) {
  const password = process.env.AICRATIVE_ACCESS_PASSWORD;
  if (!password) return res.status(503).json({ message: 'Password akses belum dikonfigurasi di Vercel.' });

  if (req.method === 'GET') {
    return validCookie(req, password)
      ? res.status(200).json({ authorized: true })
      : res.status(401).json({ authorized: false });
  }
  if (req.method === 'POST') {
    const supplied = typeof req.body?.password === 'string' ? req.body.password : '';
    const a = Buffer.from(supplied);
    const b = Buffer.from(password);
    const matches = a.length === b.length && timingSafeEqual(a, b);
    if (!matches) return res.status(401).json({ message: 'Password akses salah. Coba lagi.' });
    res.setHeader('Set-Cookie', 'aicrative_access=' + signature(password) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000');
    return res.status(200).json({ authorized: true });
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ message: 'Method not allowed.' });
}
