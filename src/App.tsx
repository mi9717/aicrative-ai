import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Copy,
  Download,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Film,
  Image as ImageIcon,
  Layers,
  Settings as SettingsIcon,
  BookOpen,
  FolderOpen,
  Plus,
  Trash2,
  Volume2,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  Check,
  FileCode,
  LogOut,
  AlertCircle,
  KeyRound,
  User,
  Globe,
  Palette,
  Shield,
  SlidersHorizontal,
  Compass,
  CheckCheck
} from 'lucide-react';

import { SceneData, StoryBible, ProjectData, ConnectionStatus } from './types';
import {
  buildImagePrompt,
  buildVideoPrompt,
  buildMasterCharacterReferenceSheet,
  formatPromptForTool,
} from './services/supabaseAicrative';
import { getCurrentUser, signIn, signOut, signUp } from './services/supabaseAuth';
import { clearLegacyLocalProjects, deleteCloudProject, listCloudProjects, readLegacyLocalProjects, saveCloudProject } from './services/projectCloud';
import { generateLocalCreativeProject } from './engines';

export default function App() {
  // Authentication & Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [displayNameInput, setDisplayNameInput] = useState<string>('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(false);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'studio' | 'projects' | 'guide' | 'engine'>('studio');

  const [connStatus, setConnStatus] = useState<ConnectionStatus>({
    state: 'idle',
    message: 'AICRATIVE Server Engine terhubung.',
  });

  // Story Project Parameters
  const [projectId, setProjectId] = useState<string>(() => 'proj-' + Date.now());
  const [projectTitle, setProjectTitle] = useState<string>('Petualangan Murim: Kitab Terlarang');
  const [storyIdea, setStoryIdea] = useState<string>(
    'Saya ingin membuat cerita dunia Murim tentang seorang murid sekte yang dianggap lemah. Ia menemukan kitab bela diri kuno yang menyimpan teknik terlarang, lalu berkembang menjadi pendekar kuat dan menghadapi konflik antar-sekte.'
  );
  const [sceneCount, setSceneCount] = useState<number>(8);
  const [visualStyle, setVisualStyle] = useState<string>('Stylized 3D animation');
  const [customStyle, setCustomStyle] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [additionalRules, setAdditionalRules] = useState<string>('dunia Tiongkok kuno wuxia, tanpa teknologi modern, pakaian perguruan, pertarungan pedang bertenaga dalam');
  const [dialogueLanguage, setDialogueLanguage] = useState<'id' | 'en'>('id');

  // Story Bible & Scene Results
  const [storyBible, setStoryBible] = useState<StoryBible | null>(null);
  const [scenes, setScenes] = useState<SceneData[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  // UI States
  const [selectedPromptTool, setSelectedPromptTool] = useState<'standard' | 'midjourney' | 'flux' | 'runway_kling'>('standard');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeBibleTab, setActiveBibleTab] = useState<'char' | 'world' | 'visual' | 'rules'>('char');
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);
  const [showCharacterSheetModal, setShowCharacterSheetModal] = useState<boolean>(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  // Check auth session on startup
  useEffect(() => {
    checkInitialAuth();
  }, []);

  const checkInitialAuth = async () => {
    try {
      const user = await getCurrentUser();
      setIsAuthenticated(!!user);
      setCurrentUserId(user?.id || null);
      if (user) {
        handlePingEngine();
        await refreshCloudProjects(user.id);
        initSampleProject();
      }
    } catch (error) {
      setIsAuthenticated(false);
      setAuthError(error instanceof Error ? error.message : 'Gagal memeriksa sesi.');
    }
  };

  const refreshCloudProjects = async (userId: string) => {
    try {
      let projects = await listCloudProjects();
      if (projects.length === 0) {
        const legacy = readLegacyLocalProjects();
        for (const project of legacy) await saveCloudProject(project, userId);
        if (legacy.length) {
          clearLegacyLocalProjects();
          projects = await listCloudProjects();
          setToastMessage('Proyek lama berhasil dipindahkan ke akun cloud.');
        }
      }
      setSavedProjects(projects);
    } catch (error) {
      console.error('Cloud project loading failed:', error);
      setAuthError(error instanceof Error ? error.message : 'Gagal memuat proyek cloud.');
    }
  };

  const initSampleProject = () => {
    if (!storyBible) {
      const initialProject = generateLocalCreativeProject({
        idea: storyIdea,
        sceneCount,
        visualStyle,
        ratio: aspectRatio,
        extra: additionalRules,
        language: dialogueLanguage,
      });
      setStoryBible(initialProject.bible);
      setScenes(initialProject.scenes);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyText = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      showToast('Teks berhasil disalin!');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast('Gagal menyalin teks.');
    }
  };

  const effectiveStyle = visualStyle === 'Other' && customStyle.trim() ? customStyle.trim() : visualStyle;

  // Supabase email/password authentication
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    if (!emailInput.trim() || !passwordInput) {
      setAuthError('Masukkan email dan password.');
      return;
    }
    if (authMode === 'register' && !displayNameInput.trim()) {
      setAuthError('Masukkan nama tampilan.');
      return;
    }
    setIsVerifyingAuth(true);
    try {
      if (authMode === 'register') {
        const result = await signUp(emailInput.trim(), passwordInput, displayNameInput.trim());
        if (!result.session) {
          setAuthNotice(result.message);
          setAuthMode('login');
        } else {
          setIsAuthenticated(true);
          setCurrentUserId(result.session.user.id);
          await refreshCloudProjects(result.session.user.id);
          initSampleProject();
          showToast('Akun AICRATIVE berhasil dibuat.');
        }
      } else {
        const session = await signIn(emailInput.trim(), passwordInput);
        setIsAuthenticated(true);
        setCurrentUserId(session.user.id);
        await refreshCloudProjects(session.user.id);
        initSampleProject();
        handlePingEngine();
        showToast('Berhasil masuk ke AICRATIVE.');
      }
      setPasswordInput('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Autentikasi gagal.');
    } finally {
      setIsVerifyingAuth(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setIsAuthenticated(false);
    setCurrentUserId(null);
    setSavedProjects([]);
    setPasswordInput('');
    setAuthError(null);
    showToast('Anda telah keluar dari akun.');
  };

  // Local Creative Engine runs in the browser; no provider connection is required.
  const handlePingEngine = () => {
    setConnStatus({
      state: 'success',
      message: 'Local Creative Engine siap. Semua prompt diproses di browser tanpa API AI eksternal.',
      lastTestedAt: new Date(),
    });
  };

  // Generation flow
  const handleTriggerGenerate = () => {
    if (!storyIdea.trim()) {
      showToast('Tuliskan ide cerita terlebih dahulu.');
      return;
    }
    if (visualStyle === 'Other' && !customStyle.trim()) {
      showToast('Isi gaya visual kustom terlebih dahulu.');
      return;
    }
    setShowLanguageModal(true);
  };

  const handleExecuteGeneration = async () => {
    setShowLanguageModal(false);
    setIsGenerating(true);
    setGenerationStep('Local Creative Engine menyusun Character, Story, dan Scene...');

    try {
      const generated = generateLocalCreativeProject({
        idea: storyIdea,
        sceneCount,
        visualStyle: effectiveStyle,
        ratio: aspectRatio,
        extra: additionalRules,
        language: dialogueLanguage,
      });
      const bibleResult = generated.bible;
      const finalScenes = generated.scenes;

      setGenerationStep('Mengunci identitas karakter dan merakit prompt produksi...');
      setProjectTitle(bibleResult.title || projectTitle);
      setStoryBible(bibleResult);
      setScenes(finalScenes);

      const newProj: ProjectData = {
        id: projectId,
        title: bibleResult.title || projectTitle,
        idea: storyIdea,
        sceneCount,
        visualStyle,
        customStyle,
        aspectRatio,
        additionalRules,
        dialogueLanguage,
        bible: bibleResult,
        scenes: finalScenes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (currentUserId) {
        await saveCloudProject(newProj, currentUserId);
        await refreshCloudProjects(currentUserId);
      }
      showToast('Character, Story, Scene, Image Prompt, dan Video Prompt berhasil dibuat secara lokal.');
      setTimeout(() => {
        document.getElementById('productionResults')?.scrollIntoView({ behavior: 'smooth' });
      }, 250);
    } catch (error) {
      console.error('Local Creative Engine error:', error);
      showToast('Generator lokal mengalami kendala. Periksa kembali input proyek.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleReapplyBible = () => {
    if (!storyBible || scenes.length === 0) return;
    const updated = scenes.map((s, idx) => ({
      ...s,
      image: buildImagePrompt(storyBible, s, idx, effectiveStyle, aspectRatio),
      video: buildVideoPrompt(storyBible, s, idx, effectiveStyle, aspectRatio, dialogueLanguage),
    }));
    setScenes(updated);
    showToast('Story Bible berhasil diperbarui ke semua prompt scene.');
  };

  const handleUpdateScene = (index: number, field: keyof SceneData, value: string) => {
    if (!storyBible) return;
    const updated = [...scenes];
    updated[index] = { ...updated[index], [field]: value };
    updated[index].image = buildImagePrompt(storyBible, updated[index], index, effectiveStyle, aspectRatio);
    updated[index].video = buildVideoPrompt(storyBible, updated[index], index, effectiveStyle, aspectRatio, dialogueLanguage);
    setScenes(updated);
  };

  const handleSaveCurrentProject = async () => {
    if (!storyBible || !currentUserId) return;
    const proj: ProjectData = {
      id: projectId,
      title: projectTitle || storyBible.title,
      idea: storyIdea,
      sceneCount,
      visualStyle,
      customStyle,
      aspectRatio,
      additionalRules,
      dialogueLanguage,
      bible: storyBible,
      scenes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveCloudProject(proj, currentUserId);
      await refreshCloudProjects(currentUserId);
      showToast(`Proyek "${proj.title}" berhasil disimpan ke cloud.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan proyek.');
    }
  };

  const handleLoadProject = (p: ProjectData) => {
    setProjectId(p.id);
    setProjectTitle(p.title);
    setStoryIdea(p.idea);
    setSceneCount(p.sceneCount);
    setVisualStyle(p.visualStyle);
    if (p.customStyle) setCustomStyle(p.customStyle);
    setAspectRatio(p.aspectRatio);
    setAdditionalRules(p.additionalRules);
    setDialogueLanguage(p.dialogueLanguage);
    setStoryBible(p.bible);
    setScenes(p.scenes);
    setActiveTab('studio');
    showToast(`Proyek "${p.title}" dimuat ke Studio.`);
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteCloudProject(id);
      if (currentUserId) await refreshCloudProjects(currentUserId);
      showToast('Proyek berhasil dihapus dari koleksi cloud.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menghapus proyek.');
    }
  };

  const handleNewProject = () => {
    setProjectId('proj-' + Date.now());
    setProjectTitle('Proyek Cerita Baru');
    setStoryIdea('');
    setStoryBible(null);
    setScenes([]);
    setActiveTab('studio');
    showToast('Studio siap untuk proyek baru.');
  };

  const handleDownloadAllTxt = () => {
    if (!storyBible || scenes.length === 0) return;
    const header = [
      '=================================================================',
      `AICRATIVE MASTER PRODUCTION BIBLE — ${projectTitle.toUpperCase()}`,
      '=================================================================',
      `DIALOGUE LANGUAGE: ${dialogueLanguage === 'id' ? 'Bahasa Indonesia' : 'English'}`,
      `TOTAL SCENES: ${scenes.length}`,
      `VISUAL STYLE: ${effectiveStyle}`,
      `ASPECT RATIO: ${aspectRatio}`,
      '',
      '--- STORY BIBLE & CONTINUITY ---',
      `WORLD: ${storyBible.world}`,
      `CHARACTER: ${storyBible.character}`,
      `CHARACTER LOCK: ${storyBible.characterLock}`,
      `VISUAL IDENTITY: ${storyBible.visual}`,
      `RULES: ${storyBible.rules}`,
      '=================================================================',
      '',
    ].join('\n');

    const body = scenes
      .map((s, idx) =>
        [
          `>>> SCENE ${String(idx + 1).padStart(2, '0')}: ${s.title}`,
          `LOKASI: ${s.location}`,
          `RINGKASAN: ${s.summary}`,
          `AKSI UTAMA: ${s.action}`,
          `SPOKEN DIALOGUE: ${s.dialogue}`,
          '',
          '[IMAGE PROMPT]',
          s.image,
          '',
          '[VIDEO PROMPT + DIALOGUE + SOUND DESIGN]',
          s.video,
          '-----------------------------------------------------------------',
        ].join('\n')
      )
      .join('\n\n');

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aicrative-${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Master file .txt berhasil diekspor.');
  };

  const handleDownloadJson = () => {
    if (!storyBible || scenes.length === 0) return;
    const data = {
      projectTitle,
      exportedAt: new Date().toISOString(),
      dialogueLanguage,
      aspectRatio,
      visualStyle: effectiveStyle,
      bible: storyBible,
      scenes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aicrative-${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File JSON pipeline berhasil diekspor.');
  };

  const handleCopyAllPrompts = (type: 'image' | 'video') => {
    if (scenes.length === 0) return;
    const content = scenes
      .map(
        (s, idx) =>
          `// SCENE ${String(idx + 1).padStart(2, '0')}: ${s.title}\n` +
          formatPromptForTool(type === 'image' ? s.image || '' : s.video || '', selectedPromptTool, aspectRatio)
      )
      .join('\n\n' + '='.repeat(40) + '\n\n');
    copyText(content, `all-${type}`);
  };

  const presets = [
    {
      label: 'Dunia Murim',
      idea: 'Saya ingin membuat cerita dunia Murim tentang seorang murid sekte yang dianggap lemah. Ia menemukan kitab bela diri kuno yang menyimpan teknik terlarang, lalu berkembang menjadi pendekar kuat dan menghadapi konflik antar-sekte.',
      rules: 'dunia Tiongkok kuno wuxia, arsitektur kayu tradisional, jubah perguruan, pertarungan pedang bertenaga dalam',
    },
    {
      label: 'Dongeng Fantasi',
      idea: 'Dongeng fantasi 3D tentang seorang anak petualang yang bersahabat dengan seekor naga kecil penjaga hutan lumut purba. Mereka mencari kristal cahaya untuk membebaskan pohon kehidupan dari kabut kegelapan.',
      rules: 'dunia fantasi magis, makhluk hutan ajaib, warna hangat berkilau, ramah keluarga',
    },
    {
      label: 'Animasi Edukasi',
      idea: 'Animasi edukasi anak tentang petualangan Boni yang belajar merawat kebersihan gigi dan mengalahkan monster kuman gula bersama sikat gigi ajaib.',
      rules: 'gaya kartun 3D lembut, warna pastel ceria, pesan kesehatan positif, karakter ramah anak',
    },
    {
      label: 'Sejarah Nusantara',
      idea: 'Kisah epik pelayaran laksamana muda kerajaan Nusantara abad ke-14 yang memimpin armada kapal jung besar mengarungi samudra luas demi mengantarkan perjanjian persaudaraan antarpulau.',
      rules: 'arsitektur bata merah candi, kapal jung tradisional, kain tenun songket, akurasi properti sejarah',
    },
    {
      label: 'Cyberpunk Sci-Fi',
      idea: 'Kisah fiksi ilmiah futuristik tentang Unit-7, robot pembersih kota neon yang menemukan kesadaran batin saat merawat tanaman terakhir di puncak gedung pencakar langit.',
      rules: 'estetika cyberpunk neon, hujan malam sinematik, hologram biru, visual kontras tinggi',
    },
  ];

  // Local engine status badge
  const getStatusDisplay = () => ({
    label: 'Local Engine',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
  });

  // =========================================================================
  // RENDER: SUPABASE AUTHENTICATION
  // =========================================================================
  if (isAuthenticated === false || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-[#141619] antialiased flex flex-col justify-between p-6">
        <header className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#ff5a1f] text-white font-bold text-sm flex items-center justify-center">A</div>
            <span className="font-semibold text-base tracking-tight">AICRATIVE</span>
          </div>
          <span className="text-xs text-[#73767c]">Creative Studio</span>
        </header>
        <div className="max-w-sm w-full mx-auto my-auto py-8">
          <div className="p-7 rounded-2xl bg-white border border-[#e6e4dc] shadow-sm space-y-5">
            <div className="space-y-1.5 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#fff0e8] text-[#ff5a1f] mx-auto flex items-center justify-center mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">AICRATIVE Studio</h1>
              <p className="text-xs text-[#73767c] leading-relaxed">Buat akun gratis atau masuk untuk menyimpan proyek di cloud.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#f7f6f2]">
              <button type="button" onClick={() => { setAuthMode('login'); setAuthError(null); setAuthNotice(null); }} className={`py-2 rounded-md text-xs font-medium ${authMode === 'login' ? 'bg-white shadow-sm text-[#141619]' : 'text-[#73767c]'}`}>Masuk</button>
              <button type="button" onClick={() => { setAuthMode('register'); setAuthError(null); setAuthNotice(null); }} className={`py-2 rounded-md text-xs font-medium ${authMode === 'register' ? 'bg-white shadow-sm text-[#141619]' : 'text-[#73767c]'}`}>Daftar gratis</button>
            </div>
            {authError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"><AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><span className="leading-relaxed">{authError}</span></div>}
            {authNotice && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{authNotice}</div>}
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              {authMode === 'register' && <div><label className="text-xs font-medium block mb-1.5">Nama tampilan</label><input type="text" value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} placeholder="Nama Anda" autoComplete="name" className="w-full px-3.5 py-2.5 rounded-lg border border-[#dcd9d0] text-sm bg-white focus:outline-hidden focus:border-[#ff5a1f]" /></div>}
              <div><label className="text-xs font-medium block mb-1.5">Email</label><input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="nama@email.com" autoComplete="email" required className="w-full px-3.5 py-2.5 rounded-lg border border-[#dcd9d0] text-sm bg-white focus:outline-hidden focus:border-[#ff5a1f]" /></div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Minimal 6 karakter" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={6} required className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-[#dcd9d0] text-sm bg-white focus:outline-hidden focus:border-[#ff5a1f]" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#73767c]">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <button type="submit" disabled={isVerifyingAuth} className="w-full py-2.5 rounded-lg bg-[#ff5a1f] hover:bg-[#e64a12] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isVerifyingAuth ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Memproses...</span></> : <><span>{authMode === 'register' ? 'Buat akun gratis' : 'Masuk ke Studio'}</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
            <p className="text-[11px] text-[#8c8f95] text-center">Akun gratis. Prompt dibuat secara lokal tanpa API AI eksternal.</p>
          </div>
        </div>
        <footer className="max-w-md mx-auto w-full pb-4 text-center text-xs text-[#8c8f95]">© AICRATIVE AI Creative Production Studio</footer>
      </div>
    );
  }

  const status = getStatusDisplay();

  // =========================================================================
  // RENDER: WORKSPACE (AUTHENTICATED)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#141619] antialiased flex flex-col selection:bg-[#ff5a1f]/20 selection:text-[#ff5a1f]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2.5 bg-[#181a1d] text-white rounded-xl shadow-lg text-xs font-medium border border-white/10 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#ff5a1f]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e6e4dc] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#ff5a1f] tracking-wide uppercase">
                Pengaturan Dialog
              </span>
              <button
                onClick={() => setShowLanguageModal(false)}
                className="text-xs text-[#73767c] hover:text-[#141619]"
              >
                ✕
              </button>
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#141619]">
                Pilih Bahasa Dialog Karakter
              </h2>
              <p className="text-xs text-[#686b70] mt-1.5 leading-relaxed">
                Bahasa ini diterapkan pada kalimat yang diucapkan karakter di setiap adegan. Prompt teknis visual tetap berbahasa Inggris agar kompatibel dengan seluruh AI tool.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDialogueLanguage('id')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  dialogueLanguage === 'id'
                    ? 'border-[#ff5a1f] bg-[#fff0e8]/50 ring-1 ring-[#ff5a1f]'
                    : 'border-[#e6e4dc] bg-white hover:border-[#dcd9d0]'
                }`}
              >
                <span className="text-2xl block mb-2">🇮🇩</span>
                <strong className="block text-sm font-semibold text-[#141619]">Bahasa Indonesia</strong>
                <span className="block text-xs text-[#73767c] mt-0.5">Dialog & intonasi lokal alami.</span>
              </button>

              <button
                type="button"
                onClick={() => setDialogueLanguage('en')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  dialogueLanguage === 'en'
                    ? 'border-[#ff5a1f] bg-[#fff0e8]/50 ring-1 ring-[#ff5a1f]'
                    : 'border-[#e6e4dc] bg-white hover:border-[#dcd9d0]'
                }`}
              >
                <span className="text-2xl block mb-2">🇬🇧</span>
                <strong className="block text-sm font-semibold text-[#141619]">English</strong>
                <span className="block text-xs text-[#73767c] mt-0.5">Global English cinematic lines.</span>
              </button>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLanguageModal(false)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-[#e6e4dc] text-xs font-medium text-[#141619] bg-white hover:bg-[#f7f6f2]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteGeneration}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#ff5a1f] text-white text-xs font-medium hover:bg-[#e64a12] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Mulai Produksi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Character Reference Sheet Modal */}
      {showCharacterSheetModal && storyBible && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e6e4dc] rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e6e4dc] pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-[#141619]">
                  Master Character Reference Sheet
                </h3>
                <span className="text-xs text-[#73767c]">
                  Prompt multi-sudut pandang (depan, 3/4, samping) untuk membuat gambar referensi karakter pertama
                </span>
              </div>
              <button
                onClick={() => setShowCharacterSheetModal(false)}
                className="text-xs text-[#73767c] hover:text-[#141619] p-1"
              >
                ✕
              </button>
            </div>

            <div className="border border-[#e6e4dc] rounded-xl overflow-hidden bg-[#faf9f6]">
              <pre className="p-4 text-xs leading-relaxed font-mono text-[#333] whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                {buildMasterCharacterReferenceSheet(storyBible, effectiveStyle, aspectRatio)}
              </pre>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCharacterSheetModal(false)}
                className="px-4 py-2 rounded-lg border border-[#e6e4dc] text-xs font-medium text-[#141619] bg-white hover:bg-[#f7f6f2]"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  copyText(buildMasterCharacterReferenceSheet(storyBible, effectiveStyle, aspectRatio), 'modalCharSheet');
                }}
                className="px-4 py-2 rounded-lg bg-[#ff5a1f] text-white text-xs font-medium hover:bg-[#e64a12] transition-colors flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedKey === 'modalCharSheet' ? 'Tersalin' : 'Salin Reference Prompt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFINED HEADER & SINGLE-ROW NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e6e4dc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-6 shrink-0">
            <button
              onClick={() => setActiveTab('studio')}
              className="flex items-center gap-2.5 text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-[#ff5a1f] text-white font-bold text-sm flex items-center justify-center">
                A
              </div>
              <span className="font-semibold text-sm tracking-tight text-[#141619]">
                AICRATIVE
              </span>
            </button>

            {/* Navigation items: Single row, no wrapping */}
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('studio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'studio'
                    ? 'bg-[#181a1d] text-white'
                    : 'text-[#686b70] hover:text-[#141619] hover:bg-black/5'
                }`}
              >
                Studio
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeTab === 'projects'
                    ? 'bg-[#181a1d] text-white'
                    : 'text-[#686b70] hover:text-[#141619] hover:bg-black/5'
                }`}
              >
                <span>Koleksi Proyek</span>
                {savedProjects.length > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full font-mono ${
                    activeTab === 'projects' ? 'bg-white/20' : 'bg-black/5 text-[#73767c]'
                  }`}>
                    {savedProjects.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'guide'
                    ? 'bg-[#181a1d] text-white'
                    : 'text-[#686b70] hover:text-[#141619] hover:bg-black/5'
                }`}
              >
                Panduan AI
              </button>

              <button
                onClick={() => setActiveTab('engine')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'engine'
                    ? 'bg-[#181a1d] text-white'
                    : 'text-[#686b70] hover:text-[#141619] hover:bg-black/5'
                }`}
              >
                AI Engine
              </button>
            </nav>
          </div>

          {/* Right: Compact System Status & User Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${status.dotClass}`} />
              <span className={`font-medium ${status.textClass} text-xs hidden sm:inline`}>
                {status.label}
              </span>
            </div>

            <div className="h-4 w-px bg-[#e6e4dc] hidden sm:block" />

            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded-lg border border-[#e6e4dc] text-xs text-[#686b70] hover:text-[#141619] hover:bg-black/5 transition-colors flex items-center gap-1"
              title="Keluar dari sesi"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* ==================== TAB 1: STUDIO WORKSPACE ==================== */}
        {activeTab === 'studio' && (
          <div className="space-y-6">
            {/* Active Project Bar */}
            <div className="p-4 rounded-xl bg-white border border-[#e6e4dc] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#ff5a1f] tracking-wide uppercase">
                    Proyek Aktif
                  </span>
                  <span className="text-[11px] text-[#73767c]">
                    • {scenes.length} Scene • {aspectRatio} • {dialogueLanguage === 'id' ? 'Bahasa Indonesia' : 'English'}
                  </span>
                </div>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Judul Proyek Cerita..."
                  className="text-lg font-semibold text-[#141619] bg-transparent border-b border-transparent hover:border-[#e6e4dc] focus:border-[#ff5a1f] focus:outline-hidden w-full transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveCurrentProject}
                  className="px-3 py-1.5 rounded-lg border border-[#e6e4dc] bg-white text-xs font-medium text-[#141619] hover:border-[#dcd9d0] transition-colors flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#ff5a1f]" />
                  <span>Simpan</span>
                </button>
                <button
                  type="button"
                  onClick={handleNewProject}
                  className="px-3 py-1.5 rounded-lg bg-[#181a1d] hover:bg-black text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-white/80" />
                  <span>Proyek Baru</span>
                </button>
              </div>
            </div>

            {/* Creative Input & Specifications Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Brief & Production Settings (2 Cols) */}
              <div className="lg:col-span-2 space-y-5">
                {/* Panel 1: Story Idea */}
                <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#141619]">
                      1. Ide Cerita & Premis
                    </h2>
                    <span className="text-xs text-[#73767c]">
                      Bahasa bebas
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    value={storyIdea}
                    onChange={(e) => setStoryIdea(e.target.value)}
                    placeholder="Tuliskan premis atau alur cerita yang ingin dibuat..."
                    className="w-full p-3.5 rounded-lg border border-[#dcd9d0] text-sm leading-relaxed focus:outline-hidden focus:border-[#ff5a1f] focus:ring-1 focus:ring-[#ff5a1f] bg-white transition-all placeholder:text-[#9ea0a5]"
                  />

                  {/* Preset Pills */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-medium text-[#73767c] block">
                      Inspirasi Genre:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {presets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setStoryIdea(preset.idea);
                            setAdditionalRules(preset.rules);
                            showToast(`Preset "${preset.label}" diterapkan.`);
                          }}
                          className="px-2.5 py-1 rounded-md border border-[#e6e4dc] bg-[#fbfaf8] hover:bg-white text-xs text-[#555] hover:border-[#dcd9d0] transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel 2: Technical Specifications */}
                <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#141619]">
                      2. Parameter Format & Visual
                    </h2>
                    <span className="text-xs text-[#73767c]">
                      Spesifikasi Output
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="text-xs font-medium text-[#141619] block mb-1">
                        Jumlah Scene
                      </label>
                      <select
                        value={sceneCount}
                        onChange={(e) => setSceneCount(Number(e.target.value))}
                        className="w-full p-2.5 rounded-lg border border-[#dcd9d0] text-xs bg-white focus:outline-hidden focus:border-[#ff5a1f]"
                      >
                        <option value={4}>4 Scene (Teaser / Short)</option>
                        <option value={6}>6 Scene (Ringkas)</option>
                        <option value={8}>8 Scene (Standar Studio)</option>
                        <option value={12}>12 Scene (Lengkap Sinematik)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#141619] block mb-1">
                        Gaya Visual
                      </label>
                      <select
                        value={visualStyle}
                        onChange={(e) => setVisualStyle(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-[#dcd9d0] text-xs bg-white focus:outline-hidden focus:border-[#ff5a1f]"
                      >
                        <option value="Stylized 3D animation">Stylized 3D animation</option>
                        <option value="3D feature animation cinematic">3D feature animation cinematic</option>
                        <option value="Photorealistic cinematic">Photorealistic cinematic</option>
                        <option value="Anime cinematic">Anime cinematic</option>
                        <option value="2D illustrated animation">2D illustrated animation</option>
                        <option value="Documentary realism">Documentary realism</option>
                        <option value="Other">Other (Gaya Kustom)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#141619] block mb-1">
                        Rasio Aspek
                      </label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-[#dcd9d0] text-xs bg-white focus:outline-hidden focus:border-[#ff5a1f]"
                      >
                        <option value="16:9">16:9 (Landscape YouTube)</option>
                        <option value="9:16">9:16 (Vertical Reels/TikTok)</option>
                        <option value="1:1">1:1 (Square Feed)</option>
                        <option value="4:5">4:5 (Portrait Social)</option>
                        <option value="21:9">21:9 (Ultrawide)</option>
                      </select>
                    </div>
                  </div>

                  {visualStyle === 'Other' && (
                    <div>
                      <label className="text-xs font-medium text-[#141619] block mb-1">
                        Deskripsi Gaya Visual Kustom
                      </label>
                      <input
                        type="text"
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        placeholder="Contoh: Claymation stop-motion bergaya studio Aardman dengan pencahayaan hangat..."
                        className="w-full p-2.5 rounded-lg border border-[#dcd9d0] text-xs bg-white focus:outline-hidden focus:border-[#ff5a1f]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-[#141619] block mb-1">
                      Aturan Tambahan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={additionalRules}
                      onChange={(e) => setAdditionalRules(e.target.value)}
                      placeholder="Contoh: tanpa teknologi modern, pakaian tradisional, pencahayaan golden hour..."
                      className="w-full p-2.5 rounded-lg border border-[#dcd9d0] text-xs bg-white focus:outline-hidden focus:border-[#ff5a1f]"
                    />
                  </div>

                  {/* Primary Generation CTA */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#e6e4dc]">
                    <div className="text-xs text-[#73767c]">
                      Bahasa Dialog: <strong className="text-[#141619]">{dialogueLanguage === 'id' ? 'Bahasa Indonesia' : 'English'}</strong>
                    </div>

                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={handleTriggerGenerate}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#ff5a1f] hover:bg-[#e64a12] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{generationStep || 'Memproses Cerita...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generate Paket Produksi</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Consistency Hub & Aspect Ratio (1 Col) */}
              <div className="space-y-5">
                {/* Consistency Hub Card */}
                <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-3.5">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-[#141619]">
                      Character Continuity Lock
                    </h3>
                    <p className="text-xs text-[#73767c] leading-relaxed">
                      Mengunci ciri khas wajah, pakaian, dan proporsi karakter di seluruh prompt adegan.
                    </p>
                  </div>

                  <div className="space-y-2 py-1 text-xs border-y border-[#e6e4dc]">
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[#686b70]">Wajah & Kostum</span>
                      <span className="font-medium text-emerald-700 flex items-center gap-1 text-xs">
                        <Check className="w-3 h-3" /> Locked
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[#686b70]">Arahan Kamera</span>
                      <span className="font-medium text-emerald-700 flex items-center gap-1 text-xs">
                        <Check className="w-3 h-3" /> Auto-Adapted
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[#686b70]">Dialog Lip-Sync</span>
                      <span className="font-medium text-emerald-700 flex items-center gap-1 text-xs">
                        <Check className="w-3 h-3" /> Verbatim
                      </span>
                    </div>
                  </div>

                  {storyBible && (
                    <button
                      type="button"
                      onClick={() => setShowCharacterSheetModal(true)}
                      className="w-full py-2 px-3 rounded-lg bg-[#fbfaf8] hover:bg-[#fff0e8] text-[#141619] hover:text-[#ff5a1f] text-xs font-medium transition-colors border border-[#e6e4dc] flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#ff5a1f]" />
                      <span>Master Ref Sheet Prompt</span>
                    </button>
                  )}
                </div>

                {/* Aspect Ratio Box */}
                <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#73767c]">Target Rasio Frame</span>
                    <span className="font-mono font-semibold text-[#ff5a1f]">{aspectRatio}</span>
                  </div>

                  <div className="h-24 bg-[#fbfaf8] rounded-lg flex items-center justify-center border border-[#e6e4dc] p-2">
                    <div
                      className="border border-[#ff5a1f] bg-[#ff5a1f]/10 rounded flex items-center justify-center text-xs font-semibold text-[#ff5a1f]"
                      style={{
                        width:
                          aspectRatio === '16:9'
                            ? '100%'
                            : aspectRatio === '9:16'
                            ? '36px'
                            : aspectRatio === '1:1'
                            ? '64px'
                            : aspectRatio === '4:5'
                            ? '52px'
                            : '100%',
                        height:
                          aspectRatio === '16:9'
                            ? '48px'
                            : aspectRatio === '9:16'
                            ? '64px'
                            : aspectRatio === '1:1'
                            ? '64px'
                            : aspectRatio === '4:5'
                            ? '64px'
                            : '36px',
                      }}
                    >
                      {aspectRatio}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone 2: Story Bible & Continuity Hub */}
            {storyBible && (
              <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e6e4dc] pb-3.5">
                  <div>
                    <h2 className="text-base font-semibold text-[#141619]">
                      Story Bible & Master Continuity
                    </h2>
                    <p className="text-xs text-[#73767c] mt-0.5">
                      Parameter bersama yang diterapkan otomatis ke seluruh adegan.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCharacterSheetModal(true)}
                      className="px-3 py-1.5 rounded-lg border border-[#e6e4dc] bg-white text-xs font-medium hover:border-[#dcd9d0] text-[#141619] transition-colors flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#ff5a1f]" />
                      <span>Master Ref Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReapplyBible}
                      className="px-3 py-1.5 rounded-lg bg-[#181a1d] hover:bg-black text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Update ke Semua Scene</span>
                    </button>
                  </div>
                </div>

                {/* Sub-tabs for Bible */}
                <div className="flex border-b border-[#e6e4dc] gap-1 overflow-x-auto pb-1">
                  <button
                    onClick={() => setActiveBibleTab('char')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeBibleTab === 'char'
                        ? 'bg-[#181a1d] text-white'
                        : 'text-[#686b70] hover:text-[#141619]'
                    }`}
                  >
                    Karakter & Lock
                  </button>
                  <button
                    onClick={() => setActiveBibleTab('world')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeBibleTab === 'world'
                        ? 'bg-[#181a1d] text-white'
                        : 'text-[#686b70] hover:text-[#141619]'
                    }`}
                  >
                    Dunia Cerita
                  </button>
                  <button
                    onClick={() => setActiveBibleTab('visual')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeBibleTab === 'visual'
                        ? 'bg-[#181a1d] text-white'
                        : 'text-[#686b70] hover:text-[#141619]'
                    }`}
                  >
                    Identitas Visual
                  </button>
                  <button
                    onClick={() => setActiveBibleTab('rules')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeBibleTab === 'rules'
                        ? 'bg-[#181a1d] text-white'
                        : 'text-[#686b70] hover:text-[#141619]'
                    }`}
                  >
                    Aturan Kontinuitas
                  </button>
                </div>

                {/* Tab Content */}
                <div className="pt-1">
                  {activeBibleTab === 'char' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[#141619]">
                          Deskripsi Karakter Utama
                        </label>
                        <textarea
                          rows={4}
                          value={storyBible.character}
                          onChange={(e) => setStoryBible({ ...storyBible, character: e.target.value })}
                          className="w-full p-3 rounded-lg border border-[#dcd9d0] text-xs leading-relaxed focus:outline-hidden focus:border-[#ff5a1f]"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-[#ff5a1f]">
                            Character Consistency Lock (Kunci Identitas)
                          </label>
                          <span className="text-[11px] text-[#73767c]">Tersimpan di seluruh prompt</span>
                        </div>
                        <textarea
                          rows={4}
                          value={storyBible.characterLock}
                          onChange={(e) => setStoryBible({ ...storyBible, characterLock: e.target.value })}
                          className="w-full p-3 rounded-lg border border-[#ff5a1f]/30 bg-[#fbfaf8] text-xs leading-relaxed focus:outline-hidden focus:border-[#ff5a1f]"
                        />
                      </div>
                    </div>
                  )}

                  {activeBibleTab === 'world' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#141619]">
                        Dunia Cerita (Worldbuilding & Lingkungan)
                      </label>
                      <textarea
                        rows={4}
                        value={storyBible.world}
                        onChange={(e) => setStoryBible({ ...storyBible, world: e.target.value })}
                        className="w-full p-3 rounded-lg border border-[#dcd9d0] text-xs leading-relaxed focus:outline-hidden focus:border-[#ff5a1f]"
                      />
                    </div>
                  )}

                  {activeBibleTab === 'visual' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#141619]">
                        Identitas Visual & Estetika Sinematik
                      </label>
                      <textarea
                        rows={3}
                        value={storyBible.visual}
                        onChange={(e) => setStoryBible({ ...storyBible, visual: e.target.value })}
                        className="w-full p-3 rounded-lg border border-[#dcd9d0] text-xs leading-relaxed focus:outline-hidden focus:border-[#ff5a1f]"
                      />
                    </div>
                  )}

                  {activeBibleTab === 'rules' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#141619]">
                        Aturan Kontinuitas, Pencahayaan, & Properti
                      </label>
                      <textarea
                        rows={3}
                        value={storyBible.rules}
                        onChange={(e) => setStoryBible({ ...storyBible, rules: e.target.value })}
                        className="w-full p-3 rounded-lg border border-[#dcd9d0] text-xs leading-relaxed focus:outline-hidden focus:border-[#ff5a1f]"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Zone 3: Production Scene Board */}
            {scenes.length > 0 && (
              <div id="productionResults" className="space-y-5 pt-1">
                {/* Action Bar */}
                <div className="p-4 rounded-xl bg-white border border-[#e6e4dc] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#141619]">
                      Rangkaian Adegan ({scenes.length} Scene)
                    </h2>
                    <span className="text-xs text-[#73767c]">
                      Prompt gambar dan video terpisah dengan arahan kamera dan desain audio.
                    </span>
                  </div>

                  {/* Format Filter & Export Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#f7f6f2] p-1 rounded-lg border border-[#e6e4dc]">
                      <span className="text-xs text-[#73767c] px-1.5">Target:</span>
                      <button
                        onClick={() => setSelectedPromptTool('standard')}
                        className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                          selectedPromptTool === 'standard' ? 'bg-white shadow-xs text-[#141619]' : 'text-[#73767c]'
                        }`}
                      >
                        Standar
                      </button>
                      <button
                        onClick={() => setSelectedPromptTool('midjourney')}
                        className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                          selectedPromptTool === 'midjourney' ? 'bg-white shadow-xs text-[#141619]' : 'text-[#73767c]'
                        }`}
                      >
                        Midjourney v6
                      </button>
                      <button
                        onClick={() => setSelectedPromptTool('flux')}
                        className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                          selectedPromptTool === 'flux' ? 'bg-white shadow-xs text-[#141619]' : 'text-[#73767c]'
                        }`}
                      >
                        Flux.1
                      </button>
                      <button
                        onClick={() => setSelectedPromptTool('runway_kling')}
                        className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                          selectedPromptTool === 'runway_kling' ? 'bg-white shadow-xs text-[#141619]' : 'text-[#73767c]'
                        }`}
                      >
                        Runway/Kling
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyAllPrompts('image')}
                      className="px-3 py-1.5 rounded-lg border border-[#e6e4dc] bg-white text-xs font-medium text-[#141619] hover:border-[#dcd9d0] transition-colors"
                    >
                      {copiedKey === 'all-image' ? 'Tersalin' : 'Copy Semua Image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyAllPrompts('video')}
                      className="px-3 py-1.5 rounded-lg bg-[#181a1d] hover:bg-black text-white text-xs font-medium transition-colors"
                    >
                      {copiedKey === 'all-video' ? 'Tersalin' : 'Copy Semua Video'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadAllTxt}
                      className="px-3 py-1.5 rounded-lg border border-[#e6e4dc] bg-white text-xs font-medium text-[#141619] hover:border-[#dcd9d0] transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5 text-[#ff5a1f]" />
                      <span>Export .txt</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="px-3 py-1.5 rounded-lg border border-[#e6e4dc] bg-white text-xs font-medium text-[#141619] hover:border-[#dcd9d0] transition-colors flex items-center gap-1"
                      title="Export format JSON untuk pipeline otomatis"
                    >
                      <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                {/* Scene Cards Stack */}
                <div className="space-y-5">
                  {scenes.map((scene, idx) => {
                    const formattedImage = formatPromptForTool(scene.image || '', selectedPromptTool, aspectRatio);
                    const formattedVideo = formatPromptForTool(scene.video || '', selectedPromptTool, aspectRatio);

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#e6e4dc] bg-white overflow-hidden shadow-xs"
                      >
                        {/* Scene Header */}
                        <div className="p-4 border-b border-[#e6e4dc] bg-[#faf9f6] flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-[#fff0e8] text-[#ff5a1f] font-semibold text-xs flex items-center justify-center shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </div>
                            <div>
                              <input
                                type="text"
                                value={scene.title}
                                onChange={(e) => handleUpdateScene(idx, 'title', e.target.value)}
                                className="font-semibold text-sm text-[#141619] bg-transparent hover:border-b border-[#dcd9d0] focus:border-[#ff5a1f] focus:outline-hidden"
                              />
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-[#73767c]">
                                <span>📍 {scene.location}</span>
                                <span>• Scene {idx + 1} dari {scenes.length}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-[#f0eee6] text-[#555] font-medium">
                              {dialogueLanguage === 'id' ? '🇮🇩 Lip-Sync' : '🇬🇧 Lip-Sync'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const payload = `SCENE ${idx + 1}: ${scene.title}\n\n[IMAGE]\n${formattedImage}\n\n[VIDEO]\n${formattedVideo}`;
                                copyText(payload, `scene-both-${idx}`);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-[#e6e4dc] text-xs font-medium text-[#555] bg-white hover:border-[#dcd9d0] flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3 text-[#ff5a1f]" />
                              <span>{copiedKey === `scene-both-${idx}` ? 'Tersalin' : 'Copy Scene'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Scene Body */}
                        <div className="p-4 sm:p-5 space-y-4">
                          <div className="p-3.5 rounded-lg bg-[#fbfaf8] text-xs grid grid-cols-1 md:grid-cols-3 gap-3 border border-[#f0eee6]">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-medium text-[#73767c] block">
                                Ringkasan Naratif:
                              </span>
                              <p className="text-xs text-[#333] leading-relaxed">
                                {scene.summary}
                              </p>
                            </div>

                            <div className="space-y-0.5">
                              <span className="text-[11px] font-medium text-[#73767c] block">
                                Aksi Utama:
                              </span>
                              <p className="text-xs text-[#333] leading-relaxed">
                                {scene.action}
                              </p>
                            </div>

                            <div className="space-y-0.5 bg-white p-2.5 rounded border border-[#e6e4dc]">
                              <span className="text-[11px] font-medium text-[#ff5a1f] flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                <span>Spoken Dialogue (Verbatim):</span>
                              </span>
                              <p className="text-xs font-medium text-[#141619] italic">
                                {scene.dialogue}
                              </p>
                            </div>
                          </div>

                          {/* Side-by-Side Dual Prompt Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Image Prompt */}
                            <div className="border border-[#e6e4dc] rounded-lg overflow-hidden bg-white flex flex-col">
                              <div className="p-2.5 px-3 bg-[#faf9f6] border-b border-[#e6e4dc] flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <ImageIcon className="w-3.5 h-3.5 text-[#ff5a1f]" />
                                  <span className="text-xs font-semibold text-[#141619]">
                                    Image Prompt
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyText(formattedImage, `img-${idx}`)}
                                  className="px-2 py-0.5 rounded bg-white border border-[#e6e4dc] text-xs font-medium text-[#141619] hover:border-[#dcd9d0] flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3 text-[#ff5a1f]" />
                                  <span>{copiedKey === `img-${idx}` ? 'Tersalin' : 'Copy'}</span>
                                </button>
                              </div>
                              <pre className="p-3.5 text-xs leading-relaxed font-mono text-[#333] whitespace-pre-wrap break-words max-h-48 overflow-y-auto bg-white flex-1">
                                {formattedImage}
                              </pre>
                            </div>

                            {/* Video Prompt */}
                            <div className="border border-[#e6e4dc] rounded-lg overflow-hidden bg-white flex flex-col">
                              <div className="p-2.5 px-3 bg-[#faf9f6] border-b border-[#e6e4dc] flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Film className="w-3.5 h-3.5 text-[#ff5a1f]" />
                                  <span className="text-xs font-semibold text-[#141619]">
                                    Video Prompt + Audio
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyText(formattedVideo, `vid-${idx}`)}
                                  className="px-2 py-0.5 rounded bg-white border border-[#e6e4dc] text-xs font-medium text-[#141619] hover:border-[#dcd9d0] flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3 text-[#ff5a1f]" />
                                  <span>{copiedKey === `vid-${idx}` ? 'Tersalin' : 'Copy'}</span>
                                </button>
                              </div>
                              <pre className="p-3.5 text-xs leading-relaxed font-mono text-[#333] whitespace-pre-wrap break-words max-h-48 overflow-y-auto bg-white flex-1">
                                {formattedVideo}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: PROJECTS VAULT ==================== */}
        {activeTab === 'projects' && (
          <div className="space-y-5 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-[#141619]">
                  Koleksi Proyek
                </h1>
                <p className="text-xs text-[#73767c] mt-0.5">
                  Proyek cerita tersimpan aman di akun cloud Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={handleNewProject}
                className="px-3.5 py-2 rounded-lg bg-[#ff5a1f] hover:bg-[#e64a12] text-white text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mulai Proyek Baru</span>
              </button>
            </div>

            {savedProjects.length === 0 ? (
              <div className="p-12 rounded-xl bg-white border border-[#e6e4dc] text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#fff0e8] text-[#ff5a1f] mx-auto flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#141619]">
                  Belum Ada Proyek Tersimpan
                </h3>
                <p className="text-xs text-[#73767c] max-w-xs mx-auto leading-relaxed">
                  Buka tab Studio, susun ide cerita, lalu klik tombol "Simpan" untuk menyimpannya di sini.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('studio')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181a1d] text-white text-xs font-medium hover:bg-black transition-colors"
                >
                  Buka Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {savedProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleLoadProject(p)}
                    className="p-4 rounded-xl bg-white border border-[#e6e4dc] hover:border-[#ff5a1f] transition-all cursor-pointer space-y-2.5 relative group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-medium text-[#ff5a1f] block">
                          {p.scenes?.length || 0} Scene • {p.aspectRatio || '16:9'}
                        </span>
                        <h3 className="text-sm font-semibold text-[#141619] group-hover:text-[#ff5a1f] transition-colors line-clamp-1">
                          {p.title || 'Untitled Project'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(p.id, e)}
                        className="p-1 rounded text-[#73767c] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Hapus proyek"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-[#686b70] line-clamp-2 leading-relaxed">
                      {p.idea || 'Tidak ada deskripsi'}
                    </p>

                    <div className="pt-2 border-t border-[#f0eee6] flex items-center justify-between text-xs text-[#73767c]">
                      <span>Style: {p.visualStyle}</span>
                      <span className="font-medium text-[#ff5a1f] flex items-center gap-1">
                        <span>Buka</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: CREATOR PLAYBOOK ==================== */}
        {activeTab === 'guide' && (
          <div className="space-y-5 max-w-4xl mx-auto">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[#141619]">
                Panduan Penggunaan AICRATIVE
              </h1>
              <p className="text-xs text-[#73767c] mt-0.5">
                Langkah penggunaan prompt hasil studio di berbagai platform AI populer.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#fff0e8] text-[#ff5a1f] flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#141619]">
                  1. Generator Gambar (Midjourney / Flux / Leonardo)
                </h3>
                <ul className="text-xs text-[#555] space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>Gunakan <em>"Master Ref Sheet Prompt"</em> untuk membuat gambar acuan karakter pertama.</li>
                  <li>Salin <strong>Image Prompt</strong> per scene dari AICRATIVE Studio.</li>
                  <li>Gunakan URL gambar acuan tadi sebagai <code className="text-[#ff5a1f]">--cref [URL]</code> di Midjourney atau Image-to-Image di Flux.</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#f0eee6] text-[#141619] flex items-center justify-center">
                  <Film className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#141619]">
                  2. Generator Video (Runway / Kling / Luma)
                </h3>
                <ul className="text-xs text-[#555] space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>Gunakan gambar yang sudah dihasilkan sebagai <em>Start Frame</em> (Image-to-Video).</li>
                  <li>Salin <strong>Video Prompt</strong> dari AICRATIVE (mencakup camera direction, sound design, & lip-sync).</li>
                  <li>Jalankan animasi 5-10 detik untuk tiap adegan.</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Volume2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#141619]">
                  3. Dialog & Dubbing (ElevenLabs / Hedra)
                </h3>
                <ul className="text-xs text-[#555] space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>Salin baris dialog verbatim dari adegan ke generator audio.</li>
                  <li>Untuk video talking-head dengan bibir sinkron presisi, gunakan Hedra atau Kling Lipsync feature.</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#141619]">
                  4. Assembly & Editing (CapCut / Premiere)
                </h3>
                <ul className="text-xs text-[#555] space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>Ekspor naskah menggunakan tombol <strong>"Export .txt"</strong> atau <strong>"JSON"</strong> sebagai acuan editor.</li>
                  <li>Gabungkan klip per adegan berurutan dari Scene 01 hingga penutup.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: LOCAL CREATIVE ENGINE ==================== */}
        {activeTab === 'engine' && (
          <div className="space-y-5 max-w-3xl mx-auto">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[#141619]">Local Creative Engine</h1>
              <p className="text-xs text-[#73767c] mt-0.5">
                Mesin prompt berbasis aturan, preset, template, dan komposisi lokal. Tidak menggunakan API AI eksternal.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-[#e6e4dc] space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold text-[#141619]">Engine siap digunakan</h3>
              </div>
              <p className="text-xs text-[#73767c] leading-relaxed">
                Semua proses Character, Story, Scene, Image Prompt, dan Video Prompt berjalan langsung di browser. Tidak ada request generasi ke xKiro, Gemini, OpenAI, atau provider AI lainnya.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {['Character Identity & Lock','Story Bible & Story Arc','Scene Builder','Image Prompt Composer','Video Prompt, Camera & Sound'].map((item) => (
                  <div key={item} className="rounded-lg border border-[#e6e4dc] bg-[#faf9f6] p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#8c8f95]">
                Catatan: engine lokal menyusun hasil dari logika dan template terprogram. Engine ini tidak menjalankan model bahasa besar dan tidak membuat file gambar/video.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* REFINED MINIMAL FOOTER */}
      <footer className="border-t border-[#e6e4dc] bg-white py-4 px-4 sm:px-6 text-xs text-[#73767c]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#141619]">AICRATIVE</span>
            <span>• AI Creative Production Studio</span>
          </div>
          <div className="text-[11px] text-[#8c8f95]">
            One Idea. Consistent Worlds. Production-Ready Prompts.
          </div>
        </div>
      </footer>
    </div>
  );
}
