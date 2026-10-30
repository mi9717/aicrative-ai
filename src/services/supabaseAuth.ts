type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user: SupabaseUser;
};
export type SupabaseUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SESSION_KEY = 'aicrative_supabase_session_v1';

function configError() {
  return !SUPABASE_URL || !SUPABASE_KEY
    ? 'Konfigurasi Supabase belum lengkap. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di environment Vercel.'
    : null;
}
function readSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as SupabaseSession : null;
  } catch { return null; }
}
function saveSession(session: SupabaseSession | null) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else {
    const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, expires_at: expiresAt }));
  }
}
async function authRequest(path: string, body?: unknown, method = 'POST', token?: string) {
  const missing = configError();
  if (missing) throw new Error(missing);
  const response = await fetch(SUPABASE_URL + '/auth/v1/' + path, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Autentikasi Supabase gagal.');
  return data;
}

async function signInAnonymously(): Promise<SupabaseSession> {
  const data = await authRequest('signup', { data: { display_name: 'AICRATIVE Guest' } });
  if (!data.access_token) throw new Error('Supabase belum mengaktifkan Anonymous Sign-Ins. Aktifkan di Authentication > Sign In / Providers > Anonymous.');
  saveSession(data as SupabaseSession);
  return data as SupabaseSession;
}
export async function getAccessToken(): Promise<string> {
  const session = readSession();
  if (!session) throw new Error('Sesi berakhir. Silakan muat ulang AICRATIVE.');
  if ((session.expires_at || 0) > Math.floor(Date.now() / 1000) + 60) return session.access_token;
  const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
  saveSession(refreshed as SupabaseSession);
  return (refreshed as SupabaseSession).access_token;
}
export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const session = readSession();
  if (!session) return (await signInAnonymously()).user;
  try {
    const token = await getAccessToken();
    const user = await authRequest('user', undefined, 'GET', token);
    return user as SupabaseUser;
  } catch {
    saveSession(null);
    return (await signInAnonymously()).user;
  }
}
export async function signOut() {
  window.location.reload();
}
