import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'aicrative_access';
const TTL = 30 * 24 * 60 * 60;
const rate = new Map();

const digest = value => createHash('sha256').update(value).digest();

function authorized(req) {
  const password = process.env.AICRATIVE_ACCESS_PASSWORD;
  const item = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
  if (!password || !item) return false;
  const parts = item.slice(COOKIE.length + 1).split('.');
  if (parts.length !== 2) return false;
  const issued = Number(parts[0]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(issued) || issued > now + 60 || now - issued > TTL) return false;
  const expected = createHmac('sha256', password).update('aicrative-shared-access-v2:' + issued).digest('hex');
  return timingSafeEqual(digest(parts[1]), digest(expected));
}

function send(res, status, data) { return res.status(status).json(data); }
function str(value, max = 4000) { return typeof value === 'string' ? value.slice(0, max) : ''; }
function likelyIndonesian(value) {
  return /\b(yang|dengan|untuk|pada|dari|seorang|tokoh|lokasi|tempat|adegan|menjadi|tersebut|adalah|dan|atau|tidak|harus|melihat|berjalan|berdiri|duduk|kamar|sekolah|perundungan)\b/i.test(value);
}

function composePrompt(project, scene, translated, index, mode) {
  const dialogue = str(scene.dialogue, 1200);
  const language = project.dialogueLanguage === 'en' ? 'English' : 'Indonesian';
  const dialogueBlock = dialogue
    ? 'DIALOGUE — VERBATIM\nSpeak exactly this line in ' + language + ':\n' + dialogue + '\nDo not translate, paraphrase, shorten, or add words. Use natural delivery and accurate lip synchronization. No subtitles unless requested.'
    : 'No spoken dialogue, narration, or subtitles.';
  const camera = /fight|battle|combat|duel|attack/i.test(translated.action)
    ? 'Use a controlled lateral tracking shot. Keep action readable and non-graphic.'
    : /discover|find|notice|reveal/i.test(translated.action)
      ? 'Use an over-the-shoulder composition and a gentle rack focus toward the discovered detail.'
      : /speak|say|dialogue|talk/i.test(translated.action)
        ? 'Use a medium close-up with the face and mouth clearly visible for dialogue synchronization.'
        : /run|chase|escape/i.test(translated.action)
          ? 'Use a smooth tracking shot following the subject while maintaining stable screen direction.'
          : 'Use a gentle dolly-in toward the subject, stable framing, and a brief hold on the emotional beat.';
  const lines = [
    'AICRATIVE — GOOGLE FLOW OPTIMIZED VIDEO PROMPT',
    'PROJECT: ' + translated.projectTitle,
    'SCENE ' + String(index + 1).padStart(2, '0') + ': ' + translated.sceneTitle,
    '',
    'SCENE AND SETTING',
    'Location: ' + translated.location,
    'Visual event: ' + translated.action,
    'Show one clear, continuous, non-graphic visual event. Keep background activity secondary.',
    '',
    'CHARACTER IDENTITY AND CONTINUITY',
    translated.character,
    'Preserve the same face, age, hairstyle, skin tone, body proportions, wardrobe, footwear, and accessories in every frame. Use the supplied character reference as the source of truth.',
    'No identity drift, face morphing, costume changes, flicker, warped anatomy, or extra limbs.',
    '',
    'WORLD AND VISUAL DIRECTION',
    translated.world,
    translated.visualDirection,
    translated.continuityRules,
    '',
    'PERFORMANCE AND MOTION',
    'Use restrained, readable expressions and simple, physically plausible movement. Avoid multiple conflicting actions.',
    '',
    'CAMERA DIRECTION',
    camera,
    'Use one continuous camera movement and keep the main subject clearly visible.',
    '',
    'LIGHTING AND COMPOSITION',
    'Use coherent cinematic lighting, natural shadows, a clear focal point, and consistent environmental materials.',
    '',
    'SOUND DESIGN',
    'AMBIENCE: Subtle environmental sound appropriate to the location.',
    'FOLEY: Sounds caused only by visible actions, synchronized naturally.',
    'MUSIC: Restrained cinematic instrumental score; keep dialogue clearly in front.',
    '',
    dialogueBlock,
    '',
    'OUTPUT',
    'Visual style direction: ' + translated.visualDirection,
    'Aspect ratio: ' + str(project.aspectRatio, 20),
    'Cinematic 24fps motion. Keep the scene coherent from first frame to last.',
  ];
  if (mode === 'cinematic') {
    const at = lines.indexOf('CAMERA DIRECTION');
    lines.splice(at, 0,
      'SHOT-BY-SHOT SEQUENCE',
      'SHOT 01 — ESTABLISHING: Establish the location and character in context.',
      'SHOT 02 — MAIN ACTION: Show the single central action clearly in a medium composition.',
      'SHOT 03 — EMOTIONAL DETAIL: End on the character reaction or consequence; hold briefly without adding a new event.',
      'Maintain exact character, wardrobe, location, lighting, and screen-direction continuity between shots.',
      '');
    lines.push('If the video tool cannot reliably create multiple shots in one generation, generate each shot as a separate clip.');
  }
  return lines.join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { message: 'Method not allowed.' }); }
  try {
    if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { message: 'Cross-origin request rejected.' });
  } catch { return send(res, 403, { message: 'Invalid request origin.' }); }
  if (!authorized(req)) return send(res, 401, { message: 'Sesi akses berakhir. Silakan masuk kembali.' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].slice(0, 120);
  const now = Date.now();
  const prev = rate.get(ip);
  if (prev && now - prev.start < 60_000 && prev.count >= 8) {
    res.setHeader('Retry-After', '60');
    return send(res, 429, { message: 'Batas permintaan tercapai. Tunggu satu menit.' });
  }
  rate.set(ip, !prev || now - prev.start >= 60_000 ? { start: now, count: 1 } : { start: prev.start, count: prev.count + 1 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return send(res, 503, { code: 'GEMINI_KEY_MISSING', message: 'GEMINI_API_KEY belum dipasang di Vercel. Video Prompt belum dapat diterjemahkan.' });

  const project = req.body?.project;
  const scenes = req.body?.scenes;
  const mode = req.body?.mode === 'cinematic' ? 'cinematic' : 'standard';
  if (!project?.bible || !Array.isArray(scenes) || scenes.length < 1 || scenes.length > 30) return send(res, 400, { message: 'Data proyek atau scene tidak valid.' });
  if (JSON.stringify({ project, scenes }).length > 250_000) return send(res, 413, { message: 'Data scene terlalu besar.' });

  const source = {
    projectTitle: str(project.bible.title || project.title, 300),
    visualStyle: str(project.visualStyle, 200),
    aspectRatio: str(project.aspectRatio, 20),
    dialogueLanguage: project.dialogueLanguage === 'en' ? 'en' : 'id',
    bible: {
      character: str(project.bible.character),
      characterLock: str(project.bible.characterLock),
      world: str(project.bible.world),
      visual: str(project.bible.visual, 3000),
      rules: str(project.bible.rules, 3000),
    },
    scenes: scenes.map((s, index) => ({
      index, title: str(s.title, 300), summary: str(s.summary, 2000),
      location: str(s.location, 3000), action: str(s.action, 3000),
    })),
  };

  const instruction = `Translate every visual/story field in ALL scenes into concise natural English for a Google Flow video prompt. Return ONLY valid JSON in this exact shape:
{"scenes":[{"index":0,"projectTitle":"...","sceneTitle":"...","location":"...","action":"...","character":"...","world":"...","visualDirection":"...","continuityRules":"..."}]}
Rules:
- Return exactly ${scenes.length} scene objects, one for EACH input scene, preserving every numeric index and order. Do not omit later scenes.
- Translate the project title, scene title, location, action, character identity, world description, visual direction, and continuity rules to English. Keep proper names unchanged.
- Do not output Indonesian prose in any visual field.
- Each scene must be independently usable. Summarize only the context needed to visualize that scene; do not repeat the entire story synopsis.
- Turn vague actions into one simple, filmable, non-graphic action while preserving the intended story beat. Do not invent plot events.
- For school-age characters, keep content age-appropriate. Describe bullying/conflict without slurs, humiliation, graphic injury, or glorification of violence.
- Do not translate or create dialogue. Dialogue is supplied separately and must remain verbatim.
- Preserve only established character traits; do not invent age, ethnicity, or physical details.
INPUT:
${JSON.stringify(source)}`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: instruction }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
      signal: AbortSignal.timeout(55_000),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini translation provider error:', response.status, data?.error?.message || 'unknown');
      return send(res, 502, { message: 'Layanan penerjemah gagal. Coba lagi beberapa saat.' });
    }
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!raw) return send(res, 502, { message: 'Penerjemah tidak mengembalikan hasil.' });
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length !== scenes.length) return send(res, 502, { message: 'Terjemahan tidak lengkap. Tidak ada prompt final yang ditampilkan.' });

    const prompts = parsed.scenes.map((t, index) => {
      if (t.index !== index) throw new Error('scene order mismatch');
      for (const field of ['projectTitle', 'sceneTitle', 'location', 'action', 'character', 'world', 'visualDirection', 'continuityRules']) {
        if (typeof t[field] !== 'string' || !t[field].trim() || likelyIndonesian(t[field])) throw new Error('English validation failed');
      }
      return composePrompt(source, scenes[index], t, index, mode);
    });
    return send(res, 200, { prompts, mode, language: 'en', sceneCount: prompts.length });
  } catch (error) {
    console.error('AICRATIVE Flow prompt error:', error);
    return send(res, 502, { message: error instanceof Error && error.message.includes('English validation') ? 'Ada scene yang belum sepenuhnya berbahasa Inggris. Silakan coba generate ulang.' : 'Gagal menyusun Video Prompt Flow. Silakan coba lagi.' });
  }
}
