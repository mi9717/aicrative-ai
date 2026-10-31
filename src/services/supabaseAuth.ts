if (typeof window !== 'undefined') {
  try {
    // Remove legacy browser-stored Supabase tokens from the previous per-user auth flow.
    localStorage.removeItem('aicrative_supabase_session_v1');
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

export type SupabaseUser = {
  id: string;
  user_metadata?: Record<string, unknown>;
};

type AuthResponse = { user: SupabaseUser | null; success?: boolean; message?: string };

async function authRequest(body?: Record<string, string>, method = 'GET'): Promise<AuthResponse> {
  const response = await fetch('/api/auth', {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Akses AICRATIVE gagal.');
  return data as AuthResponse;
}

// The shared password cookie is issued by /api/access. This endpoint only
// exposes a synthetic workspace identity to keep the existing app state flow.
export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const result = await authRequest();
  return result.user;
}

export async function signOut(): Promise<void> {
  const result = await authRequest({ action: 'logout' }, 'POST');
  if (!result.success) throw new Error(result.message || 'Tidak dapat mengakhiri sesi akses.');
}
