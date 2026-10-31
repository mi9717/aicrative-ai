import type { ProjectData } from '../types';

const LOCAL_KEY = 'aicrative_projects_v2';

async function request(path = '/api/projects', init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Gagal mengakses penyimpanan proyek.');
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function listCloudProjects(): Promise<ProjectData[]> {
  const rows = await request() as Array<{ id: string; project_data: ProjectData; created_at: string; updated_at: string }>;
  return rows.map(row => ({ ...row.project_data, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }));
}

export async function saveCloudProject(project: ProjectData): Promise<void> {
  await request('/api/projects', { method: 'POST', body: JSON.stringify({ project }) });
}

export async function deleteCloudProject(id: string): Promise<void> {
  await request('/api/projects?id=' + encodeURIComponent(id), { method: 'DELETE' });
}

export function readLegacyLocalProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) as ProjectData[] : [];
  } catch { return []; }
}

export function clearLegacyLocalProjects() {
  localStorage.removeItem(LOCAL_KEY);
}
