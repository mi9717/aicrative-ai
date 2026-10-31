export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type AuthResponse = { user: SupabaseUser | null; message?: string };

if (typeof window !== 'undefined') {
  try {
    // Remove the previous browser-stored Supabase tokens. The new session is HttpOnly.
    localStorage.removeItem('aicrative_supabase_session_v1');
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

async function authRequest(body?: Record<string, string>, method = 'GET'): Promise<AuthResponse> {
  const response = await fetch('/api/auth', {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Autentikasi AICRATIVE gagal.');
  return data as AuthResponse;
}

export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const result = await authRequest();
  return result.user;
}

export async function signOut(): Promise<void> {
  try {
    await authRequest({ action: 'logout' }, 'POST');
  } catch (error) {
    console.warn('AICRATIVE sign-out could not be confirmed:', error);
  }
}

export async function signUp(email: string, password: string, displayName: string) {
  const result = await authRequest({ action: 'register', email, password, displayName }, 'POST');
  return {
    session: result.user ? { user: result.user } : null,
    message: result.message || 'Periksa email untuk verifikasi.',
  };
}

export async function signIn(email: string, password: string): Promise<{ user: SupabaseUser }> {
  const result = await authRequest({ action: 'login', email, password }, 'POST');
  if (!result.user) throw new Error('Login tidak menghasilkan sesi aktif.');
  return { user: result.user };
}
