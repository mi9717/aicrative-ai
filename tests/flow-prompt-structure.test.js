import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShotBrief, buildContinuityAudit } from '../api/lib/flow-prompt-structure.js';

const translated = {
  character: 'A young martial artist wearing a dark blue training robe.',
  action: 'He discovers an ancient book on a wooden altar.',
  location: 'A quiet stone chamber inside an old mountain temple.',
  continuityRules: 'Keep the book on the altar and preserve the same robe and hairstyle.',
};

test('shot brief includes production slots and aspect ratio', () => {
  const result = buildShotBrief({ translated, camera: 'Slow over-the-shoulder push-in.', dialogueBlock: 'No spoken dialogue.', aspectRatio: '16:9' });
  for (const label of ['Format:', 'Subject:', 'Visible action:', 'Setting:', 'Camera:', 'Beats:', 'Audio:', 'Preserve:', 'Avoid:']) assert.ok(result.includes(label), 'missing slot: ' + label);
  assert.ok(result.includes('16:9'));
  assert.ok(result.includes(translated.action));
});

test('continuity audit carries scene-specific rules', () => {
  const result = buildContinuityAudit(translated);
  assert.ok(result.includes(translated.continuityRules));
  assert.match(result, /Do not silently redesign/);
  assert.match(result, /screen direction/);
});

test('shot brief preserves verbatim dialogue text', () => {
  const dialogue = 'DIALOGUE — VERBATIM\nSpeak exactly: "Aku akan kembali."';
  const result = buildShotBrief({ translated, camera: 'Locked shot.', dialogueBlock: dialogue, aspectRatio: '9:16' });
  assert.ok(result.includes('Aku akan kembali.'));
});
