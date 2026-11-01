export type SharedAccessUser = { id: 'shared-workspace' };

async function accessRequest(method: 'GET' | 'POST' | 'DELETE', password?: string) {
  const response = await fetch('/api/access', {
    method,
    headers: {
      ...(password === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(password === undefined ? {} : { body: JSON.stringify({ password }) }),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Akses AICRATIVE gagal diproses.');
  }
  return data;
}

export async function getCurrentUser(): Promise<SharedAccessUser | null> {
  try {
    const data = await accessRequest('GET');
    return data.authorized ? { id: 'shared-workspace' } : null;
  } catch (error) {
    if (error instanceof Error && /503/.test(error.message)) throw error;
    return null;
  }
}

export async function signIn(password: string): Promise<void> {
  await accessRequest('POST', password);
}

export async function signOut(): Promise<void> {
  try {
    await accessRequest('DELETE');
  } catch (error) {
    console.warn('AICRATIVE sign-out could not be confirmed:', error);
  }
}
