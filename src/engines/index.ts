import type { SceneData, StoryBible } from '../types';
import { buildCharacterProfile, buildCharacterReferencePrompt } from './characterEngine';
import { generateImagePrompt } from './imagePromptEngine';
import { generateScenes } from './sceneEngine';
import { generateStoryBible, type StoryInput } from './storyEngine';
import { generateVideoPrompt } from './videoPromptEngine';

export { buildCharacterProfile, buildCharacterReferencePrompt } from './characterEngine';
export { generateImagePrompt } from './imagePromptEngine';
export { generateScenes } from './sceneEngine';
export { generateStoryBible } from './storyEngine';
export { generateVideoPrompt } from './videoPromptEngine';

export interface LocalCreativeProject {
  bible: StoryBible;
  scenes: SceneData[];
  characterProfile: string;
  characterReferencePrompt: string;
}

export function generateLocalCreativeProject(input: StoryInput): LocalCreativeProject {
  const { bible, beats } = generateStoryBible(input);
  const scenes = generateScenes(beats, input).map((scene, index) => ({
    ...scene,
    image: generateImagePrompt(bible, scene, index, input.visualStyle, input.ratio),
    video: generateVideoPrompt(bible, scene, index, input.visualStyle, input.ratio, input.language),
  }));
  return {
    bible,
    scenes,
    characterProfile: buildCharacterProfile(bible),
    characterReferencePrompt: buildCharacterReferencePrompt(bible, input.visualStyle, input.ratio),
  };
}
