import { clearSharedAccessCookie, isSharedAccessAuthorized } from './access.js';
import { sharedProjectsRest } from '../server/sharedProjects.js';

function sendError(res, error) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  return res.status(status).json({
    message: status === 500 ? 'Layanan penyimpanan proyek sedang bermasalah. Periksa konfigurasi cloud.' : 'Operasi proyek tidak dapat diproses.',
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    const host = req.headers.host;
    let sameOrigin = false;
    try {
      const parsed = new URL(origin || '');
      sameOrigin = !!host && parsed.host === host && (parsed.protocol === 'https:' || parsed.hostname === 'localhost');
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) return res.status(403).json({ message: 'Permintaan lintas-origin ditolak.' });
  }

  if (!isSharedAccessAuthorized(req)) {
    clearSharedAccessCookie(res);
    return res.status(401).json({ message: 'Sesi akses berakhir. Masukkan kembali password AICRATIVE.' });
  }

  try {
    if (req.method === 'GET') {
      const rows = await sharedProjectsRest(
        'shared_projects?select=id,title,project_data,created_at,updated_at&order=updated_at.desc',
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
      let serialized;
      try {
        serialized = JSON.stringify(project);
      } catch {
        return res.status(400).json({ message: 'Data proyek tidak dapat dibaca.' });
      }
      if (!id || id.length > 128 || title.length > 200 || serialized.length > 900_000) {
        return res.status(413).json({ message: 'Ukuran atau identitas proyek tidak valid.' });
      }

      await sharedProjectsRest('shared_projects?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          id,
          title,
          project_data: project,
          updated_at: new Date().toISOString(),
        },
      });
      return res.status(200).json({ success: true });
    }

    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    if (!id || id.length > 128) return res.status(400).json({ message: 'ID proyek tidak valid.' });
    await sharedProjectsRest('shared_projects?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
}
