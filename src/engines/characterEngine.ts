import type { StoryBible } from '../types';

export function buildCharacterProfile(bible: StoryBible): string {
  return [
    'CANONICAL CHARACTER PROFILE',
    bible.character.trim(),
    '',
    'IDENTITY LOCK',
    bible.characterLock.trim(),
    '',
    'CONTINUITY CHECKLIST',
    '- Keep the same face shape, eye shape, skin tone, hairstyle and hairline.',
    '- Keep body proportions, height impression and silhouette consistent.',
    '- Keep the exact outfit, colors, footwear and signature accessories.',
    '- Change only pose, expression and action when the scene requires it.',
    '- Do not add new scars, jewelry, props or costume details unless specified.',
  ].join('\n');
}

export function buildCharacterReferencePrompt(bible: StoryBible, visualStyle: string, ratio: string): string {
  return [
    'AICRATIVE — MASTER CHARACTER REFERENCE SHEET',
    'PROJECT: ' + bible.title,
    '',
    'CHARACTER DESCRIPTION:',
    bible.character,
    '',
    'IDENTITY LOCK:',
    bible.characterLock,
    '',
    'VISUAL STYLE: ' + visualStyle,
    'WORLD CONTEXT: ' + bible.world,
    '',
    'Create one clean character reference sheet showing the exact same character in front, three-quarter, side profile and close-up views. Preserve identical facial identity, hairstyle, body proportions, outfit construction, colors, footwear and accessories in every view. Neutral uncluttered studio background, full-body proportions clearly visible, professional production concept art.',
    'ASPECT RATIO: ' + ratio,
    'No extra characters, no labels, no typography, no watermark.',
  ].join('\n');
}
