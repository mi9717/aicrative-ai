export interface SceneData {
  id?: string;
  title: string;
  summary: string;
  location: string;
  action: string;
  dialogue: string;
  image?: string;
  video?: string;
  cameraMovement?: string;
  soundAmbience?: string;
}

export interface StoryBible {
  title: string;
  world: string;
  character: string;
  characterLock: string;
  visual: string;
  rules: string;
}

export interface ProjectData {
  id: string;
  title: string;
  idea: string;
  sceneCount: number;
  visualStyle: string;
  customStyle?: string;
  aspectRatio: string;
  additionalRules: string;
  dialogueLanguage: 'id' | 'en';
  bible: StoryBible;
  scenes: SceneData[];
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionSettings {
  model: string;
  mode: 'auto' | 'supabase' | 'local';
  supabaseUrl?: string;
  supabaseKey?: string;
}

export interface ConnectionStatus {
  state: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  latencyMs?: number;
  lastResponse?: string;
  lastTestedAt?: Date;
}

export interface AuditItem {
  id: string;
  file: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  wrongData: string;
  correctData: string;
  impact: string;
  status: 'fixed';
}
