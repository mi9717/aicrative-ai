import type { SceneData, StoryBible } from '../types';

function cameraDirection(scene: SceneData): string {
  const text = (scene.title + ' ' + scene.summary + ' ' + scene.action).toLowerCase();
  if (/lari|kejar|kabur|chase|run/.test(text)) return 'Smooth tracking shot following the subject; preserve screen direction and stable eyelines.';
  if (/bertarung|serang|duel|fight|battle|pedang/.test(text)) return 'Controlled lateral tracking shot; keep choreography readable and avoid disorienting whip pans.';
  if (/bicara|dialog|menjelaskan|talk|speak/.test(text)) return 'Medium close-up with subtle push-in; keep the face and mouth clearly visible for dialogue sync.';
  if (/menemukan|petunjuk|rahasia|discover|find/.test(text)) return 'Over-the-shoulder reveal followed by a slow rack focus toward the discovered object.';
  if (/pemandangan|gunung|laut|istana|panorama/.test(text)) return 'Slow crane or panoramic establishing move that reveals spatial scale.';
  return 'Gentle dolly-in toward the subject with stable framing and a brief hold on the emotional beat.';
}

function soundDirection(scene: SceneData): string {
  const text = (scene.location + ' ' + scene.action).toLowerCase();
  const ambience = /laut|pantai|ocean/.test(text) ? 'soft waves and sea breeze' :
    /hutan|gunung|forest/.test(text) ? 'wind through leaves and distant birds' :
    /istana|gua|ruang|interior/.test(text) ? 'subtle room tone with natural architectural reverberation' :
    /kota|sekolah|pasar/.test(text) ? 'restrained environmental activity and distant voices' :
    'location-appropriate natural ambience';
  return 'AMBIENCE: ' + ambience + '\nFOLEY: precise footsteps, fabric movement and object interactions synchronized to visible action.\nMUSIC: restrained cinematic score; keep spoken dialogue clearly in front of music.';
}

export function generateVideoPrompt(bible: StoryBible, scene: SceneData, index: number, visualStyle: string, ratio: string, language: 'id' | 'en'): string {
  return [
    'AICRATIVE PRODUCTION PROMPT — VIDEO GENERATION',
    'PROJECT: ' + bible.title,
    'SCENE ' + String(index + 1).padStart(2, '0') + ': ' + scene.title,
    'LOCATION: ' + scene.location,
    'ACTION: ' + scene.action,
    '',
    'CAMERA DIRECTION:',
    cameraDirection(scene),
    '',
    'SOUND DESIGN:',
    soundDirection(scene),
    '',
    'CHARACTER CONTINUITY:',
    bible.characterLock,
    bible.character,
    'Keep the same identity, wardrobe and accessories throughout every frame. No morphing, face drift or costume changes.',
    '',
    'DIALOGUE (VERBATIM):',
    scene.dialogue,
    'LANGUAGE: ' + (language === 'id' ? 'Bahasa Indonesia' : 'English'),
    'Deliver the exact line with natural emotional timing and accurate lip synchronization. Do not add subtitles unless requested.',
    '',
    'VISUAL STYLE: ' + visualStyle,
    'ASPECT RATIO: ' + ratio,
    'MOTION: physically plausible movement, coherent screen direction, stable 24fps cinematic motion.',
    'AVOID: identity drift, flicker, warped faces, extra limbs, abrupt camera movement and unintended scene cuts.',
  ].join('\n');
}
