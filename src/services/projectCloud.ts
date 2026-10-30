import type { ProjectData } from '../types';
import { getAccessToken } from './supabaseAuth';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const LOCAL_KEY = 'aicrative_projects_v2';

async function request(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Konfigurasi Supabase belum lengkap.');
  const token = await getAccessToken();
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.details || 'Gagal mengakses penyimpanan proyek.');
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listCloudProjects(): Promise<ProjectData[]> {
  const rows = await request('projects?select=id,title,project_data,created_at,updated_at&order=updated_at.desc') as Array<{ id: string; project_data: ProjectData; created_at: string; updated_at: string }>;
  return rows.map(row => ({ ...row.project_data, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }));
}
export async function saveCloudProject(project: ProjectData): Promise<void> {
  const payload = {
    id: project.id,
    title: project.title,
    project_data: project,
    updated_at: new Date().toISOString(),
  };
  await request('projects?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });
}
export async function deleteCloudProject(id: string): Promise<void> {
  await request('projects?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
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
