import type { SceneData } from '../types';
import type { StoryBeat, StoryInput } from './storyEngine';

const DIALOGUES = {
  id: [
    'Tokoh: "Aku harus memahami apa yang sebenarnya terjadi."',
    'Tokoh: "Tidak ada jalan kembali. Aku harus mengambil keputusan."',
    'Tokoh: "Kita siapkan semuanya sebelum melangkah."',
    'Tokoh: "Tantangan ini lebih besar dari yang kubayangkan."',
    'Tokoh: "Petunjuk ini mengubah semua yang kita ketahui."',
    'Tokoh: "Aku tidak akan membiarkan kegagalan menentukan akhir cerita."',
    'Tokoh: "Sekarang saatnya menyelesaikan semuanya."',
    'Tokoh: "Perjalanan ini telah mengubah diriku."',
  ],
  en: [
    'Protagonist: "I need to understand what is really happening."',
    'Protagonist: "There is no turning back. I have to decide."',
    'Protagonist: "We should prepare everything before moving."',
    'Protagonist: "This challenge is greater than I expected."',
    'Protagonist: "This clue changes everything we know."',
    'Protagonist: "I will not let failure decide how this ends."',
    'Protagonist: "Now it is time to settle this."',
    'Protagonist: "This journey has changed who I am."',
  ],
};

export function generateScenes(beats: StoryBeat[], input: StoryInput): SceneData[] {
  return beats.map((beat, index) => ({
    id: 'scene-' + String(index + 1).padStart(3, '0'),
    title: beat.title,
    summary: beat.summary,
    location: beat.location + '. Konteks: ' + input.idea.trim(),
    action: beat.action,
    dialogue: DIALOGUES[input.language][index % DIALOGUES[input.language].length],
  }));
}
