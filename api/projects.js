import {
  clearSessionCookie,
  getValidSession,
  isSameOrigin,
  setNoStoreHeaders,
  supabaseRest,
} from '../server/session.js';

function sendError(res, error) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  return res.status(status).json({
    message: status === 500 ? 'Layanan penyimpanan proyek sedang bermasalah. Coba lagi.' : error.message,
  });
}

export default async function handler(req, res) {
  setNoStoreHeaders(res);
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ message: 'Method not allowed.' });
  }
  if (req.method !== 'GET' && !isSameOrigin(req)) {
    return res.status(403).json({ message: 'Permintaan lintas-origin ditolak.' });
  }

  try {
    const session = await getValidSession(req, res);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Sesi berakhir. Silakan masuk kembali.' });
    }

    if (req.method === 'GET') {
      const rows = await supabaseRest(
        'projects?select=id,title,project_data,created_at,updated_at&order=updated_at.desc',
        { token: session.access_token },
      );
      return res.status(200).json(rows || []);
    }

    if (req.method === 'POST') {
      const project = req.body?.project;
      if (!project || typeof project !== 'object' || Array.isArray(project)) {
        return res.status(400).json({ message: 'Data proyek tidak valid.' });
      }
      const id = typeof project.id === 'string' ? project.id : '';
      const title = typeof project.title === 'string' ? project.title : 'Untitled project';
      const serialized = JSON.stringify(project);
      if (!id || id.length > 128 || title.length > 200 || serialized.length > 900_000) {
        return res.status(413).json({ message: 'Ukuran atau identitas proyek tidak valid.' });
      }
      await supabaseRest('projects?on_conflict=id', {
        method: 'POST',
        token: session.access_token,
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          id,
          user_id: session.user.id,
          title,
          project_data: project,
          updated_at: new Date().toISOString(),
        },
      });
      return res.status(200).json({ success: true });
    }

    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    if (!id || id.length > 128) return res.status(400).json({ message: 'ID proyek tidak valid.' });
    await supabaseRest('projects?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE',
      token: session.access_token,
      prefer: 'return=minimal',
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
}
