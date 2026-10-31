import {
  clearSessionCookie,
  createSupabaseSession,
  getValidSession,
  isSameOrigin,
  revokeSupabaseSession,
  setNoStoreHeaders,
  setSessionCookie,
} from '../server/session.js';

function sendError(res, error) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  return res.status(status).json({
    message: status === 500 ? 'Layanan autentikasi sedang bermasalah. Coba lagi.' : error.message,
  });
}

export default async function handler(req, res) {
  setNoStoreHeaders(res);
  try {
    if (req.method === 'GET') {
      const session = await getValidSession(req, res, { verifyUser: true });
      if (!session) return res.status(200).json({ user: null });
      return res.status(200).json({
        user: {
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata || {},
        },
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ message: 'Method not allowed.' });
    }
    if (!isSameOrigin(req)) return res.status(403).json({ message: 'Permintaan lintas-origin ditolak.' });

    const action = req.body?.action;
    if (action === 'login') {
      const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      if (!email || !password || email.length > 320 || password.length > 1024) {
        return res.status(400).json({ message: 'Email atau password tidak valid.' });
      }
      const session = await createSupabaseSession('token?grant_type=password', { email, password });
      setSessionCookie(res, session);
      return res.status(200).json({
        user: { id: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata || {} },
      });
    }

    if (action === 'register') {
      const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
      if (!email || !password || !displayName || email.length > 320 || password.length > 1024 || displayName.length > 120) {
        return res.status(400).json({ message: 'Nama, email, atau password tidak valid.' });
      }
      const result = await createSupabaseSession('signup', { email, password, data: { display_name: displayName } });
      if (result.access_token) {
        setSessionCookie(res, result);
        return res.status(200).json({
          user: { id: result.user.id, email: result.user.email, user_metadata: result.user.user_metadata || {} },
          message: 'Akun berhasil dibuat.',
        });
      }
      return res.status(200).json({ user: null, message: 'Periksa email untuk verifikasi.' });
    }

    if (action === 'logout') {
      const session = await getValidSession(req, res);
      await revokeSupabaseSession(session);
      clearSessionCookie(res);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ message: 'Aksi autentikasi tidak dikenal.' });
  } catch (error) {
    return sendError(res, error);
  }
}
