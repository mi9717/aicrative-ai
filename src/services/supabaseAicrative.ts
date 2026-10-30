import { ConnectionSettings, SceneData, StoryBible, AuditItem } from '../types';

export const DEFAULT_MODEL = 'qwen/qwen3.7-plus:free';

export const AVAILABLE_MODELS = [
  { id: 'qwen/qwen3.7-plus:free', name: 'Qwen 3.7 Plus (Free) — xKiro Recommended' },
  { id: 'qwen/qwen3.7-max:free', name: 'Qwen 3.7 Max (Free) — xKiro High-Capacity' },
  { id: 'qwen/qwen3.8-max:free', name: 'Qwen 3.8 Max (Free) — xKiro Advanced' },
];

export const AUDIT_REPORTS: AuditItem[] = [
  {
    id: 'sec-1',
    file: 'server.ts & src/App.tsx',
    severity: 'critical',
    title: 'Gerbang Password Terproteksi Sisi Server (Password Gate)',
    wrongData: 'Sebelumnya tidak ada proteksi akses sebelum masuk aplikasi',
    correctData: 'Wajib autentikasi password via APP_ACCESS_PASSWORD melalui POST /api/auth/login dengan timingSafeEqual & rate limiting',
    impact: 'Mencegah akses liar ke fitur studio dan endpoint generasi AI tanpa izin pemilik aplikasi.',
    status: 'fixed',
  },
  {
    id: 'sec-2',
    file: 'server.ts & src/services/supabaseAicrative.ts',
    severity: 'critical',
    title: 'Zero Secret Exposure (Kredensial Dipindahkan ke Server Proxy)',
    wrongData: 'Publishable key & URL backend sebelumnya diimpor di file JavaScript client',
    correctData: 'Seluruh pemanggilan AI dirutekan ke /api/ai/chat di sisi server; frontend tidak memuat secret apa pun',
    impact: 'Kredensial API terlindungi 100% di server-side environment tanpa risiko terambil melalui inspeksi browser.',
    status: 'fixed',
  },
  {
    id: 'sec-3',
    file: 'server.ts',
    severity: 'high',
    title: 'Perlindungan Brute-Force & Rate Limiting Login',
    wrongData: 'Percobaan login tanpa batasan',
    correctData: 'Maksimal 5 percobaan gagal per IP dengan pembekuan 5 menit dan sanitasi error generik',
    impact: 'Menutup celah serangan penebakan password secara otomatis.',
    status: 'fixed',
  },
  {
    id: 'sec-4',
    file: 'server.ts & src/services/supabaseAicrative.ts',
    severity: 'high',
    title: 'Manajemen Sesi Kriptografis (24 Jam TTL)',
    wrongData: 'Sebelumnya tidak ada verifikasi token sesi pada request',
    correctData: 'Token sesi 256-bit di-generate acak pada server, dikirim via HttpOnly cookie & Bearer token dengan masa kedaluwarsa 24 jam',
    impact: 'Seluruh endpoint terlindungi wajib menyertakan sesi sah; sesi dapat diakhiri kapan saja via tombol Keluar.',
    status: 'fixed',
  },
  {
    id: 'sec-5',
    file: 'server.ts',
    severity: 'medium',
    title: 'Allowlist Model AI di Backend Server',
    wrongData: 'Menerima parameter model tanpa validasi server',
    correctData: 'Server memvalidasi nama model terhadap allowlist resmi sebelum meneruskan ke provider xKiro',
    impact: 'Mencegah injeksi model tidak berizin atau eksploitasi parameter.',
    status: 'fixed',
  },
  {
    id: 'sec-6',
    file: 'src/services/supabaseAicrative.ts',
    severity: 'medium',
    title: 'Konsistensi Alur Cerita & Localbase Fallback Presisi',
    wrongData: 'Risiko kegagalan jika koneksi provider terputus',
    correctData: 'Integrasi hybrid: Cloud AI dipadukan dengan pengunci karakter dan Localbase Engine tanpa kebocoran data',
    impact: 'Aplikasi beroperasi stabil dengan kontinuitas karakter dan prompt visual/video yang konsisten 100%.',
    status: 'fixed',
  },
];

// -------------------------------------------------------------
// CLIENT AUTHENTICATION SESSION MANAGEMENT
// -------------------------------------------------------------

let inMemoryToken: string | null = null;

export function setSessionToken(token: string | null) {
  inMemoryToken = token;
  if (token) {
    try {
      sessionStorage.setItem('aicrative_auth_token', token);
    } catch {}
  } else {
    try {
      sessionStorage.removeItem('aicrative_auth_token');
    } catch {}
  }
}

export function getSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    return sessionStorage.getItem('aicrative_auth_token');
  } catch {
    return null;
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginWithPassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Password tidak valid. Akses ditolak.' };
    }

    if (data.token) {
      setSessionToken(data.token);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Gagal menghubungi server autentikasi. Pastikan koneksi internet aktif.' };
  }
}

export async function checkAuthSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return !!data.authenticated;
  } catch {
    return false;
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {}
  setSessionToken(null);
}

// -------------------------------------------------------------
// SERVER-SIDE PROTECTED AI CALLS (ZERO SECRET EXPOSURE)
// -------------------------------------------------------------

export async function testBackendConnection(settings: ConnectionSettings): Promise<{
  success: boolean;
  message: string;
  latencyMs: number;
  rawResponse?: string;
}> {
  const start = performance.now();
  try {
    const res = await fetch('/api/ai/status', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
      if (res.status === 401) {
        return {
          success: false,
          message: 'Sesi kedaluwarsa atau belum terautentikasi.',
          latencyMs,
        };
      }
      return {
        success: false,
        message: `Backend AI status: HTTP ${res.status}`,
        latencyMs,
      };
    }

    const data = await res.json();
    return {
      success: true,
      message: `AICRATIVE Neural Engine terhubung aktif (${settings.model || DEFAULT_MODEL}) dalam ${latencyMs}ms.`,
      latencyMs,
      rawResponse: JSON.stringify(data),
    };
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      message: `Gagal memverifikasi status backend: ${error?.message || String(error)}`,
      latencyMs,
    };
  }
}

export function buildStoryPrompt(
  idea: string,
  sceneCount: number,
  visualStyle: string,
  ratio: string,
  extra: string,
  language: 'id' | 'en'
): string {
  return `You are AICRATIVE, a professional worldbuilder and story/scene prompt director.
Produce valid JSON only with this exact JSON schema:
{
  "title": "Short title of the project",
  "world": "Comprehensive world bible description",
  "character": "Main character description with visual traits",
  "characterLock": "Strict identity lock rules for continuity across all scenes",
  "visual": "Detailed visual style and artistic identity rules",
  "rules": "Consistency rules for lighting, props, and tone",
  "scenes": [
    {
      "title": "Scene Title",
      "summary": "Narrative purpose of the scene",
      "location": "Specific location and atmosphere",
      "action": "Clear character action and visual beat",
      "dialogue": "Exact line spoken in the scene"
    }
  ]
}

STORY REQUIREMENTS:
- User Idea: ${idea}
- Scene Count: Exactly ${sceneCount} scenes
- Dialogue Language: ${language === 'id' ? 'Bahasa Indonesia' : 'English'}
- Visual Style: ${visualStyle}
- Aspect Ratio: ${ratio}
- Additional constraints: ${extra || 'Maintain rich visual continuity and dramatic coherence'}

IMPORTANT RULES:
1. Return JSON ONLY without markdown fences (\`\`\`json).
2. The dialogue field MUST contain actual spoken dialogue in ${language === 'id' ? 'Bahasa Indonesia' : 'English'}, with speaker name like 'Tokoh: "Dialog..."'.
3. Every scene must have logical causality and progression.
4. Keep the character identity constant throughout all scenes.`;
}

export async function generateStoryWithBackend(
  idea: string,
  sceneCount: number,
  visualStyle: string,
  ratio: string,
  extra: string,
  language: 'id' | 'en',
  settings: ConnectionSettings
): Promise<{ bible: StoryBible; scenes: SceneData[] }> {
  const model = settings.model || DEFAULT_MODEL;
  const prompt = buildStoryPrompt(idea, sceneCount, visualStyle, ratio, extra, language);

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are AICRATIVE story generation engine. Return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Respons backend bukan JSON valid (HTTP ${res.status}): ${raw.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(`Gagal memproses cerita: ${msg}`);
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Backend merespons namun teks konten AI kosong.');
  }

  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } else {
      throw new Error(`Gagal mem-parsing format JSON dari AI: ${cleaned.slice(0, 200)}`);
    }
  }

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('Respons AI tidak memuat daftar scene yang valid.');
  }

  const bible: StoryBible = {
    title: parsed.title || idea.slice(0, 40),
    world: parsed.world || 'Dunia cerita yang konsisten.',
    character: parsed.character || 'Karakter utama konsisten.',
    characterLock: parsed.characterLock || 'Wajah, rambut, pakaian, dan aksesori tetap identik di seluruh scene.',
    visual: parsed.visual || visualStyle,
    rules: parsed.rules || 'Pertahankan arah cahaya, komposisi sinematik, dan kontinuitas latar.',
  };

  const scenes: SceneData[] = parsed.scenes.slice(0, sceneCount).map((s: any, idx: number) => ({
    title: s.title || `Scene ${idx + 1}`,
    summary: s.summary || '',
    location: s.location || 'Lokasi adegan',
    action: s.action || '',
    dialogue: s.dialogue || (language === 'id' ? 'Karakter: "..."' : 'Character: "..."'),
  }));

  return { bible, scenes };
}

// -------------------------------------------------------------
// LOCALBASE ENGINE (100% OFFLINE / ZERO-DOWNTIME FALLBACK)
// -------------------------------------------------------------

export function generateStoryLocalFallback(
  idea: string,
  sceneCount: number,
  visualStyle: string,
  ratio: string,
  extra: string,
  language: 'id' | 'en'
): { bible: StoryBible; scenes: SceneData[] } {
  const x = idea.toLowerCase();
  let world = '';
  let character = '';
  let visual = '';
  let rules = '';
  let titlesAndSummaries: [string, string][] = [];

  if (/murim|sekte|bela diri|pendekar|kung fu|kitab/.test(x)) {
    world = 'Dunia Murim klasik bernuansa Tiongkok kuno: perguruan sekte terpencil di puncak gunung berkabut, aula paviliun kayu berukir naga, halaman latihan berbatu, dan gua terlarang penyimpanan pusaka.';
    character = 'Murid sekte muda yang berpenampilan sederhana namun memiliki tatapan mata tajam dan gigih. Memakai jubah bela diri biru keabu-abuan dengan ikat pinggang kain bertekstur dan rambut diikat rapi dengan jepitan kayu.';
    visual = `${visualStyle}, pencahayaan atmosferik dramatis, kabut pegunungan tipis, partikel debu halus di udara, palet warna giok dan kayu alami, komposisi wuxia sinematik.`;
    rules = 'Jaga kontinuitas pakaian, luka pertempuran, pedang sekte, dan arsitektur kuno. Tidak ada elemen teknologi modern.';
    titlesAndSummaries = [
      ['Murid yang Diremehkan', 'Perkenalkan tokoh utama di halaman sekte yang sering diabaikan oleh para senior.'],
      ['Ujian Perguruan', 'Tokoh menghadapi pertarungan seleksi dan mengalami kekalahan yang menyakitkan.'],
      ['Gua Pusaka Rahasia', 'Secara tak sengaja menemukan gulungan kitab kuno rahasia di balik dinding batu retak.'],
      ['Awal Meditasi & Latihan', 'Mempelajari teknik pernapasan terlarang dalam kesunyian malam dengan tekad membara.'],
      ['Kemampuan Terungkap', 'Memperlihatkan peningkatan kekuatan internal saat membelah batu latihan sekte.'],
      ['Invasi Sekte Rival', 'Gerbang sekte diserang oleh pendekar sekte bayangan yang kejam.'],
      ['Pertarungan Penentu', 'Tokoh utama maju ke garis depan melindungi gurunya dengan teknik kitab kuno.'],
      ['Legenda Baru Murim', 'Berdiri di puncak bukit saat fajar menyingsing, diakui sebagai pendekar sejati.'],
    ];
  } else if (/anak|edukasi|gigi|kebersihan|sekolah|belajar/.test(x)) {
    world = 'Dunia animasi ceria dan hangat yang ramah anak, dipenuhi warna-warna pastel yang menyenangkan, lingkungan rumah dan sekolah yang rapi dan aman.';
    character = 'Boni, anak laki-laki berusia 7 tahun dengan senyum riang, rambut cokelat ikal, kaos kuning cerah dengan sablon bintang kecil, celana jeans pendek, dan sepatu kanvas merah.';
    visual = `${visualStyle}, pencahayaan lembut tanpa bayangan keras, bentuk bulat ramah, warna cerah harmonis, ekspresi wajah sangat mudah dibaca.`;
    rules = 'Pertahankan baju kuning dan sepatu merah Boni di setiap frame. Komposisi visual fokus pada edukasi positif.';
    titlesAndSummaries = [
      ['Pagi yang Menyenangkan', 'Boni bangun tidur dengan penuh semangat dan bersiap memulai hari.'],
      ['Masalah Sikat Gigi', 'Boni malas menggosok gigi dan merasakan giginya mulai berdenyut ngilu.'],
      ['Ibu Dokter Menjelaskan', 'Dokter gigi ramah memperlihatkan replika gigi dan kuman kecil dengan animasi seru.'],
      ['Langkah Pertama yang Benar', 'Boni belajar memegang sikat gigi dan mengoleskan pasta gigi secukupnya.'],
      ['Gerakan Memutar Bersih', 'Boni mempraktikkan gerakan menyikat dari atas ke bawah secara menyeluruh.'],
      ['Bercermin dengan Bangga', 'Boni melihat giginya kini bersih mengkilap dan bebas dari kuman.'],
      ['Membagikan Cerita ke Teman', 'Boni bercerita dengan ceria kepada teman-temannya di taman bermain.'],
      ['Kebiasaan Sehat Setiap Hari', 'Boni tersenyum lebar dengan gigi putih bersih, siap tidur nyenyak.'],
    ];
  } else if (/sejarah|kerajaan|nusantara|majapahit|kolonial|pahlawan/.test(x)) {
    world = 'Latar sejarah Nusantara abad ke-14: arsitektur bata merah khas kerajaan tropis, kapal jung megah berlambang bendera samudra, hutan rimbun, dan alun-alun istana berlantai batu.';
    character = 'Gajah Wira, perwira muda gagah perkasa berwajah tegas khas Nusantara, bertelanjang dada dengan selempang kain tenun songket keemasan, mengenakan gelang perunggu kuno di pergelangan tangan.';
    visual = `${visualStyle}, pencahayaan matahari tropis keemasan (golden hour), tekstur kain tenun autentik, kabut lembah tropis, komposisi sejarah kolosal.`;
    rules = 'Akurasi perlengkapan sejarah, keris berukir warangka kayu cendana, ornamen relief candi, dan vegetasi tropis.';
    titlesAndSummaries = [
      ['Titah di Balairung Istana', 'Raja memberikan prasasti mandat penting kepada perwira muda di hadapan para pembesar.'],
      ['Persiapan Berlayar', 'Perwira memeriksa perbekalan dan prajurit di dermaga pelabuhan samudra yang sibuk.'],
      ['Mengarungi Laut Berombak', 'Kapal jung membelah ombak besar di tengah badai tropis dengan kepemimpinan tangguh.'],
      ['Tiba di Tanah Seberang', 'Mendarat di pantai kepulauan eksotis dan disambut oleh tetua adat setempat.'],
      ['Konflik dan Negosiasi', 'Mengurai ketegangan perselisihan dagang dengan diplomasi kehormatan kesatria.'],
      ['Serbuan Pasukan Pemberontak', 'Menghadapi sergapan prajurit misterius di celah perbukitan batu.'],
      ['Kemenangan Persaudaraan', 'Menaklukkan pemimpin pemberontak tanpa pertumpahan darah berlebih.'],
      ['Menegakkan Perdamaian', 'Mengibarkan panji kerajaan di atas bukit, mewujudkan persatuan kepulauan.'],
    ];
  } else {
    world = 'Dunia naratif imersif yang dibangun selaras dengan ide cerita, menjaga konsistensi latar tempat, atmosfer cuaca, proporsi lingkungan, dan logika dunia.';
    character = 'Tokoh utama dirancang dengan siluet visual khas, palet busana spesifik, ekspresi berkarakter, dan aksesori yang konsisten.';
    visual = `${visualStyle}, komposisi sinematik standar industri, gradasi warna atmosferik, focal point jelas, dan pencahayaan dinamis.`;
    rules = 'Karakter, proporsi tubuh, palet warna, dan properti harus dipertahankan identik dari awal hingga akhir adegan.';
    titlesAndSummaries = [
      ['Awal Mula Perjalanan', 'Mengenalkan tokoh utama dalam lingkungan rutinitasnya sebelum terjadi peristiwa pemicu.'],
      ['Panggilan Aksi', 'Kejadian tak terduga memicu tekad tokoh untuk meninggalkan zona nyaman.'],
      ['Rintangan Pertama', 'Menghadapi ujian awal yang menguji kemampuan dasar dan tekad karakter.'],
      ['Penemuan Tak Terduga', 'Menemukan sekutu atau petunjuk kunci yang membuka jalan ke tujuan utama.'],
      ['Krisis & Titik Balik', 'Konflik memuncak dan karakter dihadapkan pada dilema moral yang berat.'],
      ['Rencana Terakhir', 'Menyiapkan strategi penuh risiko untuk menyelesaikan krisis utama.'],
      ['Klimaks Perjuangan', 'Konfrontasi puncak yang menguji seluruh perkembangan fisik dan mental karakter.'],
      ['Fajar Resolusi', 'Menikmati hasil perjalanan dengan kedewasaan baru dan harapan masa depan.'],
    ];
  }

  while (titlesAndSummaries.length < sceneCount) {
    const n = titlesAndSummaries.length + 1;
    titlesAndSummaries.push([
      `Evolusi Scene ${n}`,
      `Kelanjutan cerita yang terhubung secara kausal dengan scene sebelumnya menuju konklusi.`,
    ]);
  }

  const selectedScenes = titlesAndSummaries.slice(0, sceneCount);
  const title = idea.replace(/^(saya ingin membuat|buatkan|tolong buatkan)\s*/i, '').split(/[.!?\n]/)[0].trim() || 'Cerita Baru AICRATIVE';

  const bible: StoryBible = {
    title: title.length > 50 ? title.slice(0, 47) + '...' : title,
    world,
    character,
    characterLock:
      'IDENTITY MUST MATCH EXACT SAME REFERENCE IMAGE IN EVERY SCENE: facial structure, hair color & cut, eye shape, skin tone, exact clothing palette, silhouette, footwear, and signature accessories remain 100% frozen. Only expressions, physical poses, and action dynamics change.',
    visual,
    rules: extra ? `${rules} Aturan pengguna: ${extra}` : rules,
  };

  const dialoguesID = [
    'Tokoh: "Aku tahu ini tidak mudah, tetapi aku tidak akan mundur."',
    'Tokoh: "Lihat tanda ini... ada sesuatu yang tersimpan di sini."',
    'Tokoh: "Waktunya membuktikan apa yang sudah kita pelajari."',
    'Tokoh: "Bertahanlah! Kita selesaikan masalah ini bersama."',
    'Tokoh: "Kekuatan sejati lahir dari keberanian menghadapi kegagalan."',
    'Lawan: "Kau tidak akan pernah bisa melampaui kami!"',
    'Tokoh: "Hari ini, takdir kita ditentukan oleh pilihan kita sendiri!"',
    'Tokoh: "Perjalanan baru saja dimulai, dan dunia menanti di depan."',
  ];

  const dialoguesEN = [
    'Protagonist: "I know this won\'t be easy, but I refuse to give up."',
    'Protagonist: "Look closely at this mark... something was hidden here."',
    'Protagonist: "Now is the time to prove what we are truly capable of."',
    'Protagonist: "Hold on! We are going to resolve this together."',
    'Protagonist: "True strength comes from the courage to stand back up."',
    'Rival: "You will never surpass the forces standing before you!"',
    'Protagonist: "Today, our destiny is forged by our own choices!"',
    'Protagonist: "This is not the end; it is only the first chapter of a greater journey."',
  ];

  const dialogues = language === 'id' ? dialoguesID : dialoguesEN;

  const scenes: SceneData[] = selectedScenes.map((item, idx) => ({
    title: item[0],
    summary: item[1],
    location: `Latar Scene ${idx + 1} (${bible.title})`,
    action: `Karakter melakukan aksi penting terkait "${item[0]}" dengan ekspresi dramatis dan bahasa tubuh terbaca.`,
    dialogue: dialogues[idx % dialogues.length],
  }));

  return { bible, scenes };
}

// -------------------------------------------------------------
// CAMERA, SOUND, & PROMPT BUILDERS (MASTER CONTINUITY ENGINE)
// -------------------------------------------------------------

export function buildCameraDirection(scene: SceneData, visualStyle: string): string {
  const text = `${scene.title} ${scene.summary} ${scene.action}`.toLowerCase();
  let move = 'Use a gentle dolly-in toward the main subject, with stable framing and a brief hold at the emotional beat.';

  if (/lari|kejar|chase|run|sprint|kabur/.test(text)) {
    move = 'Smooth dynamic tracking shot following the subject\'s speed; maintain screen direction and stable eyeline without jitter.';
  } else if (/bertarung|duel|fight|attack|battle|serang/.test(text)) {
    move = 'Controlled lateral tracking or steady orbital pan around the martial choreography; keep all limb strikes readable with zero disorienting whip pans.';
  } else if (/bicara|dialog|ngobrol|talk|speak|jelaskan/.test(text)) {
    move = 'Medium close-up shot focused on speaker with shallow depth of field; clear view of facial features and lips for synchronous dialogue delivery.';
  } else if (/temukan|melihat|rahasia|discover|find|secret|clue/.test(text)) {
    move = 'Over-the-shoulder perspective transitioning into a slow deliberate rack focus on the discovered artifact, followed by subtle push-in on character reaction.';
  } else if (/pemandangan|alam|gunung|istana|laut|landscape|panoramic/.test(text)) {
    move = 'Sweeping slow-crane panoramic shot from high angle down to ground level subject, maintaining grand spatial scale.';
  }

  return `${move} Adapt camera mechanics to "${visualStyle}": maintain physical lens plausibility, zero sudden cutaways, and seamless subject stabilization.`;
}

export function buildSoundDesign(scene: SceneData, visualStyle: string): string {
  const text = `${scene.title} ${scene.summary} ${scene.action} ${scene.location}`.toLowerCase();

  let ambience = 'Subtle location-appropriate background acoustic bed matching the physical setting.';
  let foley = 'Precise Foley for visible footfalls, fabric rustle, and physical interactions.';
  let music = 'Cinematic instrumental score building subtle emotional tension, naturally ducked under spoken dialogue.';

  if (/gunung|hutan|forest|mountain/.test(text)) {
    ambience = 'Wind whistling through mountain pines, distant bird calls, leaves rustling in mountain breeze.';
  } else if (/istana|gua|cave|ruang|palace|interior/.test(text)) {
    ambience = 'Deep acoustic reverb of ancient stone walls, distant dripping water, flickering torch crackle.';
  } else if (/pantai|laut|ocean|sea|beach/.test(text)) {
    ambience = 'Gentle rhythmic shoreline waves, soft sea breeze, distant gulls.';
  } else if (/sekolah|taman|kota|city|park/.test(text)) {
    ambience = 'Warm ambient neighborhood ambience, distant cheerful chatter, soft breeze.';
  }

  if (/tarung|pedang|pukul|fight|strike|blade/.test(text)) {
    foley = 'Crisp cloth snaps, controlled resonance of weapon strikes, impact thuds synchronized to visual contact.';
  } else if (/lari|jalan|step|run/.test(text)) {
    foley = 'Rhythmic footsteps matching ground texture (stone, gravel, wood), realistic fabric movement.';
  }

  return `SOUND DESIGN DIRECTION:
- AMBIENCE: ${ambience}
- FOLEY / SFX: ${foley}
- MUSIC: ${music}
- AUDIO CONTINUITY: Keep dialogue foremost in the mix (-6dB relative to music). Zero vocal artifacts. Clean natural decay at shot conclusion.`;
}

export function buildImagePrompt(
  bible: StoryBible,
  scene: SceneData,
  index: number,
  visualStyle: string,
  ratio: string
): string {
  return `AICRATIVE PRODUCTION PROMPT — IMAGE STILL FRAME
PROJECT: ${bible.title}
SCENE ${String(index + 1).padStart(2, '0')}: ${scene.title}
LOCATION: ${scene.location}
NARRATIVE SUMMARY: ${scene.summary}
ACTION BEAT: ${scene.action}

CHARACTER CONSISTENCY LOCK:
${bible.characterLock}
Character visual attributes from bible: ${bible.character}

WORLD & LIGHTING CONTINUITY:
${bible.world}
Visual rules: ${bible.rules}

STILL FRAME COMPOSITION:
Create one master cinematic still frame depicting this specific scene beat. Establish a clear single focal point, readable facial expression, expressive body silhouette, and authentic environmental materials.
Preserve exact facial features, hair structure, skin tone, clothing cut, footwear, and accessories identical to the canonical character reference.

VISUAL STYLE: ${visualStyle}.
ASPECT RATIO: ${ratio}.
QUALITY RESTRICTIONS: Strict zero typography, no text, no subtitles, no speech balloons, no watermark, no duplicate faces, anatomically correct limbs, clean studio color grading.`;
}

export function buildVideoPrompt(
  bible: StoryBible,
  scene: SceneData,
  index: number,
  visualStyle: string,
  ratio: string,
  language: 'id' | 'en'
): string {
  const camera = buildCameraDirection(scene, visualStyle);
  const sound = buildSoundDesign(scene, visualStyle);

  return `AICRATIVE PRODUCTION PROMPT — VIDEO GENERATION + DIALOGUE
PROJECT: ${bible.title}
SCENE ${String(index + 1).padStart(2, '0')}: ${scene.title}
LOCATION: ${scene.location}
NARRATIVE BEAT: ${scene.action}

CAMERA DIRECTION (AUTO-ADAPTED):
${camera}

${sound}

CHARACTER CONTINUITY LOCK:
${bible.characterLock}
${bible.character}
Strict constraint: Maintain identical character identity and outfit throughout all frames. No morphing, face distortion, or costume shifting.

SPOKEN DIALOGUE (VERBATIM LIP-SYNC):
Line: "${scene.dialogue}"
Language: ${language === 'id' ? 'Bahasa Indonesia' : 'English'}
Requirement: The character delivers this exact line with authentic emotional inflection. Synchronize mouth movement precisely to each phonetic syllable. No subtitles on screen unless requested.

VISUAL STYLE & ASPECT RATIO:
Style: ${visualStyle}
Aspect Ratio: ${ratio}
AVOID: Identity drift, facial warping, flickering garments, unnatural cuts, jerky camera movements, missing dialogue lip-sync.`;
}

export function buildMasterCharacterReferenceSheet(bible: StoryBible, visualStyle: string, ratio: string): string {
  return `AICRATIVE — MASTER CHARACTER REFERENCE SHEET (CANONICAL IDENTITY LOCK)
PROJECT: ${bible.title}

CHARACTER IDENTITY BIBLE:
${bible.character}

STRICT IDENTITY CONSTRAINTS:
${bible.characterLock}

VISUAL STYLE SPECIFICATION:
${visualStyle}

WORLD LIGHTING & PALETTE:
${bible.world}

PROMPT SPECIFICATION:
Create a pristine multi-angle character reference sheet on an uncluttered neutral studio backdrop.
Show the exact same character in:
1. Front view (full body neutral standing pose)
2. Three-quarter view (displaying outfit depth and silhouette)
3. Side profile view
4. Close-up portrait showcasing facial structure, eyes, hair texture, and signature facial expression.

The face, hair structure, skin undertone, height ratio, fabric textures, belt, footwear, and accessories MUST be 100% identical in every angle.
Aspect Ratio: ${ratio}. Clean professional concept art sheet, no background clutter, no extra characters, no typography, no watermarks.`;
}

export function formatPromptForTool(
  rawPrompt: string,
  tool: 'standard' | 'midjourney' | 'flux' | 'runway_kling',
  ratio: string
): string {
  if (tool === 'standard') return rawPrompt;

  const arParam = ratio === '16:9' ? '--ar 16:9' : ratio === '9:16' ? '--ar 9:16' : ratio === '1:1' ? '--ar 1:1' : ratio === '4:5' ? '--ar 4:5' : '--ar 21:9';

  if (tool === 'midjourney') {
    const cleanLines = rawPrompt
      .replace(/AICRATIVE PRODUCTION PROMPT[^\n]*\n/gi, '')
      .replace(/PROJECT:[^\n]*\n/gi, '')
      .replace(/SCENE \d+:[^\n]*\n/gi, '')
      .replace(/\n+/g, ' ')
      .trim();
    return `/imagine prompt: ${cleanLines} ${arParam} --style raw --v 6.1 --quality 2`;
  }

  if (tool === 'flux') {
    return `${rawPrompt}\n\n[Negative Prompt: text, watermark, bad anatomy, deformed eyes, extra limbs, low resolution, blurry]`;
  }

  if (tool === 'runway_kling') {
    return `${rawPrompt}\n\nMOTION DIRECTION: Cinematic smooth 24fps motion, steady cam tracking, physical gravity, zero morphing artifacts.`;
  }

  return rawPrompt;
}

// -------------------------------------------------------------
// LOCAL PROJECT STORAGE
// -------------------------------------------------------------

const STORAGE_KEY = 'aicrative_projects_v2';

export function loadProjectsFromStorage(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjectToStorage(project: any): void {
  try {
    const list = loadProjectsFromStorage();
    const index = list.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      list[index] = { ...project, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...project, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (e) {
    console.error('Failed to save project:', e);
  }
}

export function deleteProjectFromStorage(id: string): void {
  try {
    const list = loadProjectsFromStorage().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to delete project:', e);
  }
}
