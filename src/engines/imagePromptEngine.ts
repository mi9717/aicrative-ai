import type { SceneData, StoryBible } from '../types';

export function generateImagePrompt(bible: StoryBible, scene: SceneData, index: number, visualStyle: string, ratio: string): string {
  return [
    'AICRATIVE PRODUCTION PROMPT — IMAGE STILL FRAME',
    'PROJECT: ' + bible.title,
    'SCENE ' + String(index + 1).padStart(2, '0') + ': ' + scene.title,
    'LOCATION: ' + scene.location,
    'NARRATIVE SUMMARY: ' + scene.summary,
    'ACTION BEAT: ' + scene.action,
    '',
    'CHARACTER IDENTITY LOCK:',
    bible.characterLock,
    'Canonical character: ' + bible.character,
    '',
    'WORLD & CONTINUITY:',
    bible.world,
    'Continuity rules: ' + bible.rules,
    '',
    'FRAME DIRECTION:',
    'Create one cinematic still frame capturing this exact story beat. Use one clear focal subject, readable expression, intentional composition, physically plausible anatomy, coherent environmental scale and detailed materials.',
    'Preserve the canonical character identity, outfit, colors, body proportions and signature accessories exactly.',
    '',
    'VISUAL STYLE: ' + visualStyle,
    'ASPECT RATIO: ' + ratio,
    'NEGATIVE CONSTRAINTS: no typography, no subtitles, no speech bubbles, no watermark, no duplicate character, no extra limbs, no distorted face.',
  ].join('\n');
}
