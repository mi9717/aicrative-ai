import type { ProjectData } from '../types';

async function projectRequest(method: 'GET' | 'POST' | 'DELETE', payload?: unknown) {
  const response = await fetch('/api/projects', {
    method,
    headers: {
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Gagal mengakses ruang proyek bersama.');
  }
  return data;
}

export async function listCloudProjects(): Promise<ProjectData[]> {
  return await projectRequest('GET') as ProjectData[];
}

export async function saveCloudProject(project: ProjectData): Promise<void> {
  await projectRequest('POST', { project });
}

export async function deleteCloudProject(id: string): Promise<void> {
  await projectRequest('DELETE', { id });
}

const LOCAL_KEY = 'aicrative_projects_v2';

export function readLegacyLocalProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) as ProjectData[] : [];
  } catch {
    return [];
  }
}

export function clearLegacyLocalProjects() {
  localStorage.removeItem(LOCAL_KEY);
}
