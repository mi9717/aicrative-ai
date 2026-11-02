/**
 * AICRATIVE production prompt structure.
 * Inspired by documented production practices from:
 * - agbelemi/google-flow-scripting-skill (MIT)
 * - svenkatreddy/universal-video-skills (MIT)
 *
 * This is an original implementation; no third-party source files are copied.
 */

export function buildShotBrief({ translated, camera, dialogueBlock, aspectRatio }) {
  return [
    'SHOT BRIEF — ONE SCENE, ONE PRIMARY EVENT',
    'Format: ' + (aspectRatio || 'Use the project aspect ratio'),
    'Subject: ' + translated.character,
    'Visible action: ' + translated.action,
    'Setting: ' + translated.location,
    'Camera: ' + camera,
    'Beats: Show the action as one readable progression from beginning to completion. Do not add a second event or invent intermediate actions.',
    'Audio: ' + dialogueBlock.replace(/\n/g, ' | '),
    'Preserve: Character identity, age impression, face, hairstyle, body proportions, wardrobe, accessories, important props, location geometry, lighting direction, and screen direction.',
    'Avoid: Face drift, costume changes, extra characters, duplicated props, changing object positions, flicker, warped anatomy, extra limbs, unintended text, subtitles unless requested, abrupt cuts, and actions not present in the brief.',
  ].join('\n');
}

export function buildContinuityAudit(translated) {
  return [
    'CONTINUITY AUDIT — APPLY TO THIS SCENE AND ALL ADJACENT SCENES',
    'Treat the canonical character description and supplied reference image as the source of truth.',
    'Keep the established world rules and visual language unchanged.',
    'Do not silently redesign characters, costumes, props, architecture, or recurring locations.',
    'If a detail is not specified, keep it neutral rather than inventing a story-critical fact.',
    'Maintain plausible geography, eyelines, object positions, and screen direction.',
    'Scene-specific continuity: ' + translated.continuityRules,
  ].join('\n');
}
