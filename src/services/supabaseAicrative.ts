import type { SceneData, StoryBible } from '../types';

export function buildCameraDirection(scene: SceneData, visualStyle: string): string {
  const text = `${scene.title} ${scene.summary} ${scene.action}`.toLowerCase();
  let move = 'Use a gentle dolly-in toward the main subject, with stable framing and a brief hold at the emotional beat.';
  if (/lari|kejar|chase|run|sprint|kabur/.test(text)) move = 'Smooth dynamic tracking shot following the subject\'s speed; maintain screen direction and stable eyeline without jitter.';
  else if (/bertarung|duel|fight|attack|battle|serang/.test(text)) move = 'Controlled lateral tracking or steady orbital pan around the choreography; keep strikes readable without disorienting whip pans.';
  else if (/bicara|dialog|ngobrol|talk|speak|jelaskan/.test(text)) move = 'Medium close-up focused on the speaker with shallow depth of field and clear facial visibility for dialogue sync.';
  else if (/temukan|melihat|rahasia|discover|find|secret|clue/.test(text)) move = 'Over-the-shoulder perspective transitioning into a slow rack focus on the discovered object.';
  else if (/pemandangan|alam|gunung|istana|laut|landscape|panoramic/.test(text)) move = 'Sweeping slow-crane panoramic shot revealing the environment and spatial scale.';
  return `${move} Adapt camera mechanics to "${visualStyle}" with physically plausible lens behavior and stable subject framing.`;
}

export function buildSoundDesign(scene: SceneData, visualStyle: string): string {
  const text = `${scene.title} ${scene.summary} ${scene.action} ${scene.location}`.toLowerCase();
  let ambience = 'Subtle location-appropriate background ambience matching the physical setting.';
  let foley = 'Precise Foley for visible footfalls, fabric rustle, and physical interactions.';
  const music = 'Cinematic instrumental score building subtle emotional tension, naturally ducked under spoken dialogue.';
  if (/gunung|hutan|forest|mountain/.test(text)) ambience = 'Wind through mountain trees, distant bird calls, and leaves rustling.';
  else if (/istana|gua|cave|ruang|palace|interior/.test(text)) ambience = 'Natural reverberation of stone or timber architecture with subtle environmental details.';
  else if (/pantai|laut|ocean|sea|beach/.test(text)) ambience = 'Gentle shoreline waves and soft sea breeze.';
  else if (/sekolah|taman|kota|city|park/.test(text)) ambience = 'Warm neighborhood ambience with distant activity and a soft breeze.';
  if (/tarung|pedang|pukul|fight|strike|blade/.test(text)) foley = 'Cloth snaps, controlled weapon resonance, and impact sounds synchronized to visible contact.';
  else if (/lari|jalan|step|run/.test(text)) foley = 'Rhythmic footsteps matching ground texture with realistic fabric movement.';
  return `SOUND DESIGN DIRECTION:\n- AMBIENCE: ${ambience}\n- FOLEY / SFX: ${foley}\n- MUSIC: ${music}\n- AUDIO CONTINUITY: Keep dialogue clearly in front of music and end with a natural acoustic decay.`;
}

export function buildImagePrompt(bible: StoryBible, scene: SceneData, index: number, visualStyle: string, ratio: string): string {
  return `AICRATIVE PRODUCTION PROMPT — IMAGE STILL FRAME
PROJECT: ${bible.title}
SCENE ${String(index + 1).padStart(2, '0')}: ${scene.title}
LOCATION: ${scene.location}
NARRATIVE SUMMARY: ${scene.summary}
ACTION BEAT: ${scene.action}

CHARACTER CONSISTENCY LOCK:
${bible.characterLock}
Canonical character: ${bible.character}

WORLD & LIGHTING CONTINUITY:
${bible.world}
Visual rules: ${bible.rules}

STILL FRAME COMPOSITION:
Create one cinematic still frame depicting this exact scene beat. Establish a clear focal point, readable expression, expressive silhouette, and authentic environmental materials. Preserve the canonical character identity, facial features, hair, skin tone, clothing, footwear, and accessories.

VISUAL STYLE: ${visualStyle}
ASPECT RATIO: ${ratio}
QUALITY RESTRICTIONS: no typography, text, subtitles, speech balloons, watermark, duplicate faces, or anatomical distortions.`;
}

export function buildVideoPrompt(bible: StoryBible, scene: SceneData, index: number, visualStyle: string, ratio: string, language: 'id' | 'en'): string {
  return `AICRATIVE PRODUCTION PROMPT — VIDEO GENERATION + DIALOGUE
PROJECT: ${bible.title}
SCENE ${String(index + 1).padStart(2, '0')}: ${scene.title}
LOCATION: ${scene.location}
NARRATIVE BEAT: ${scene.action}

CAMERA DIRECTION:
${buildCameraDirection(scene, visualStyle)}

${buildSoundDesign(scene, visualStyle)}

CHARACTER CONTINUITY LOCK:
${bible.characterLock}
${bible.character}
Keep the same identity and outfit throughout every frame. No morphing, face drift, or costume changes.

SPOKEN DIALOGUE (VERBATIM):
${scene.dialogue}
LANGUAGE: ${language === 'id' ? 'Bahasa Indonesia' : 'English'}
Deliver the exact line with natural emotional timing and accurate lip synchronization. No subtitles unless requested.

VISUAL STYLE: ${visualStyle}
ASPECT RATIO: ${ratio}
AVOID: identity drift, facial warping, flickering garments, unnatural cuts, and jerky camera movements.`;
}

export function buildMasterCharacterReferenceSheet(bible: StoryBible, visualStyle: string, ratio: string): string {
  return `AICRATIVE — MASTER CHARACTER REFERENCE SHEET
PROJECT: ${bible.title}

CHARACTER IDENTITY:
${bible.character}

STRICT IDENTITY CONSTRAINTS:
${bible.characterLock}

VISUAL STYLE: ${visualStyle}
WORLD CONTEXT: ${bible.world}

Create one clean multi-angle character reference sheet on a neutral studio backdrop showing the exact same character in front, three-quarter, side profile, and close-up views. Preserve identical facial identity, hair, body proportions, outfit, footwear, and accessories in every view. No extra characters, background clutter, typography, or watermark.
ASPECT RATIO: ${ratio}.`;
}

export function formatPromptForTool(rawPrompt: string, tool: 'standard' | 'midjourney' | 'flux' | 'runway_kling', ratio: string): string {
  if (tool === 'standard') return rawPrompt;
  const ar = ratio === '16:9' ? '--ar 16:9' : ratio === '9:16' ? '--ar 9:16' : ratio === '1:1' ? '--ar 1:1' : ratio === '4:5' ? '--ar 4:5' : '--ar 21:9';
  if (tool === 'midjourney') {
    const clean = rawPrompt.replace(/AICRATIVE PRODUCTION PROMPT[^\n]*\n/gi, '').replace(/PROJECT:[^\n]*\n/gi, '').replace(/SCENE \d+:[^\n]*\n/gi, '').replace(/\n+/g, ' ').trim();
    return `/imagine prompt: ${clean} ${ar} --style raw --v 6.1 --quality 2`;
  }
  if (tool === 'flux') return `${rawPrompt}\n\n[Negative Prompt: text, watermark, bad anatomy, deformed eyes, extra limbs, low resolution, blurry]`;
  return `${rawPrompt}\n\nMOTION DIRECTION: Cinematic smooth 24fps motion, steady tracking, physical gravity, zero morphing artifacts.`;
}
