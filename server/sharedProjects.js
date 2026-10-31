function getConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error('Penyimpanan cloud belum dikonfigurasi. Periksa SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.');
  }
  return { url, key };
}

export async function sharedProjectsRest(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = getConfig();
  const response = await fetch(url + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : null;
  if (!response.ok) {
    const error = new Error('Supabase menolak operasi penyimpanan proyek.');
    error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw error;
  }
  return data;
}
