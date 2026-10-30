import type { StoryBible } from '../types';

export interface StoryInput {
  idea: string;
  sceneCount: number;
  visualStyle: string;
  ratio: string;
  extra: string;
  language: 'id' | 'en';
}

export interface StoryBeat {
  title: string;
  summary: string;
  location: string;
  action: string;
  intent: string;
}

const STORY_ARCS: StoryBeat[] = [
  { title: 'Dunia Sebelum Perubahan', summary: 'Kenalkan tokoh utama, rutinitas, lingkungan, dan kondisi awal yang akan berubah.', location: 'Lokasi utama dalam dunia cerita', action: 'Tokoh menjalani aktivitas yang memperlihatkan kepribadian, tujuan, dan situasi awal.', intent: 'exposition' },
  { title: 'Pemicu Perjalanan', summary: 'Sebuah kejadian penting mengganggu keadaan awal dan memaksa tokoh mengambil sikap.', location: 'Tempat terjadinya peristiwa pemicu', action: 'Tokoh menyaksikan atau mengalami peristiwa yang mengubah arah hidupnya.', intent: 'inciting' },
  { title: 'Keputusan dan Persiapan', summary: 'Tokoh menetapkan tujuan dan menyiapkan langkah untuk menghadapi tantangan.', location: 'Tempat persiapan atau pertemuan', action: 'Tokoh mengumpulkan informasi, perlengkapan, atau dukungan yang dibutuhkan.', intent: 'decision' },
  { title: 'Rintangan Pertama', summary: 'Tantangan awal menguji kemampuan, keberanian, dan kelemahan tokoh.', location: 'Area pertama yang penuh tantangan', action: 'Tokoh mencoba menyelesaikan masalah tetapi menemukan hambatan yang tidak diperkirakan.', intent: 'obstacle' },
  { title: 'Petunjuk dan Perkembangan', summary: 'Tokoh menemukan informasi atau kemampuan baru yang mengubah pemahamannya.', location: 'Lokasi penemuan petunjuk', action: 'Tokoh memeriksa petunjuk dan menghubungkannya dengan tujuan utama.', intent: 'discovery' },
  { title: 'Krisis dan Titik Terendah', summary: 'Konflik meningkat; keputusan atau kesalahan membawa konsekuensi besar.', location: 'Lokasi konflik paling berisiko', action: 'Tokoh menghadapi kehilangan, kegagalan, atau pilihan sulit.', intent: 'crisis' },
  { title: 'Klimaks dan Konfrontasi', summary: 'Tokoh menggunakan pelajaran sebelumnya untuk menghadapi konflik utama.', location: 'Lokasi konfrontasi akhir', action: 'Tokoh mengambil tindakan penentu dan menyelesaikan konflik inti.', intent: 'climax' },
  { title: 'Resolusi dan Babak Baru', summary: 'Tampilkan akibat dari keputusan tokoh dan perubahan yang telah dicapai.', location: 'Lokasi penutup yang bermakna', action: 'Tokoh melihat hasil perjalanan dan membuka kemungkinan cerita berikutnya.', intent: 'resolution' },
];

function detectGenre(idea: string) {
  const value = idea.toLowerCase();
  if (/murim|sekte|pendekar|kung.?fu|silat|bela diri|pedang/.test(value)) return 'martial';
  if (/anak|edukasi|sekolah|belajar|keluarga|dongeng/.test(value)) return 'family';
  if (/sejarah|kerajaan|nusantara|majapahit|kolonial|pahlawan/.test(value)) return 'historical';
  if (/sci.?fi|robot|antariksa|planet|futuristik/.test(value)) return 'scifi';
  if (/horor|hantu|misteri|teror|angker/.test(value)) return 'mystery';
  return 'general';
}

function genreWorld(genre: string): { world: string; character: string; rules: string } {
  const presets: Record<string, { world: string; character: string; rules: string }> = {
    martial: {
      world: 'Dunia bela diri klasik dengan perguruan, jalur pegunungan, aula latihan, pasar tradisional dan tempat rahasia. Bangun hubungan ruang yang masuk akal antar lokasi.',
      character: 'Tokoh utama seorang pendekar muda dengan ciri wajah, gaya rambut, postur, busana perguruan dan senjata khas yang ditetapkan sebagai identitas tetap.',
      rules: 'Pertahankan desain senjata, tingkat kemampuan, kondisi luka, kostum, lambang perguruan dan arah gerak pertarungan. Hindari teknologi modern kecuali diminta.',
    },
    family: {
      world: 'Dunia keluarga yang hangat dan aman, berpusat pada rumah, sekolah atau lingkungan bermain dengan warna dan bentuk yang ramah.',
      character: 'Tokoh utama anak atau anggota keluarga dengan usia, ciri wajah, rambut, pakaian, warna dan aksesori yang jelas serta konsisten.',
      rules: 'Jaga kesesuaian usia, proporsi tubuh, pakaian, warna, lingkungan yang aman dan pesan positif. Hindari visual yang menakutkan atau tidak sesuai usia.',
    },
    historical: {
      world: 'Dunia sejarah dengan arsitektur, lanskap, transportasi, material, busana dan benda sehari-hari yang mengikuti periode yang disebutkan dalam ide.',
      character: 'Tokoh utama memiliki identitas visual dan perlengkapan yang sesuai latar sejarah; detail yang belum ditentukan harus diperlakukan sebagai konsep, bukan fakta sejarah.',
      rules: 'Jaga kontinuitas periode, bahan, senjata, busana, arsitektur dan adat. Jangan mencampurkan elemen modern tanpa instruksi.',
    },
    scifi: {
      world: 'Dunia fiksi ilmiah dengan teknologi, kendaraan, lingkungan dan aturan visual yang konsisten serta memiliki logika internal.',
      character: 'Tokoh utama memiliki siluet, kostum, perangkat dan ciri visual futuristik yang mudah dikenali.',
      rules: 'Pertahankan desain perangkat, skala teknologi, palet cahaya, kostum dan aturan dunia; jangan mengganti bentuk teknologi antar scene.',
    },
    mystery: {
      world: 'Dunia misteri dengan lokasi berlapis, petunjuk visual, atmosfer terkontrol dan hubungan sebab-akibat yang jelas.',
      character: 'Tokoh utama memiliki ciri wajah, rambut, pakaian dan aksesori tetap agar mudah dikenali di suasana minim cahaya.',
      rules: 'Jaga kesinambungan petunjuk, posisi benda, kondisi lokasi, pencahayaan dan urutan penemuan. Jangan mengungkap misteri sebelum waktunya.',
    },
    general: {
      world: 'Dunia naratif yang dibangun dari ide pengguna dengan geografi, atmosfer, aturan sosial dan hubungan lokasi yang konsisten.',
      character: 'Tokoh utama dirancang dengan identitas wajah, rambut, postur, busana, palet warna dan aksesori khas yang dapat dipertahankan antar scene.',
      rules: 'Jaga kesinambungan identitas karakter, properti, lokasi, waktu, pencahayaan dan konsekuensi dari setiap aksi.',
    },
  };
  return presets[genre] || presets.general;
}

function cleanTitle(idea: string): string {
  const cleaned = idea.replace(/^(saya ingin membuat|saya mau membuat|buatkan|tolong buatkan|buat)\s*/i, '').split(/[.!?\n]/)[0].trim();
  return (cleaned || 'Proyek Baru AICRATIVE').slice(0, 64);
}

export function generateStoryBible(input: StoryInput): { bible: StoryBible; beats: StoryBeat[] } {
  const idea = input.idea.trim();
  const genre = detectGenre(idea);
  const preset = genreWorld(genre);
  const count = Math.max(1, Math.min(30, Math.floor(input.sceneCount) || 8));
  const beats = Array.from({ length: count }, (_, index) => {
    const base = STORY_ARCS[index % STORY_ARCS.length];
    const cycle = Math.floor(index / STORY_ARCS.length);
    return cycle === 0 ? { ...base } : {
      ...base,
      title: cycle === 1 ? base.title + ' — Pengembangan' : base.title + ' — Babak ' + (cycle + 1),
      summary: base.summary + ' Tambahkan perkembangan baru yang berasal dari konsekuensi scene sebelumnya.',
      action: base.action + ' Perlihatkan perubahan situasi yang nyata dan jangan mengulang komposisi scene sebelumnya.',
    };
  });
  const visual = input.visualStyle.trim() || 'Cinematic realistic';
  const bible: StoryBible = {
    title: cleanTitle(idea),
    world: preset.world + ' Premis pengguna: ' + idea,
    character: preset.character,
    characterLock: 'IDENTITY LOCK: wajah, bentuk mata, warna kulit, rambut, garis rambut, postur, proporsi tubuh, pakaian, palet warna, alas kaki dan aksesori harus tetap identik pada seluruh scene. Hanya ekspresi, pose dan gerakan yang boleh berubah sesuai aksi.',
    visual: visual + '. Terapkan bahasa visual, material, pencahayaan dan color grading yang konsisten.',
    rules: preset.rules + (input.extra.trim() ? ' Aturan tambahan pengguna: ' + input.extra.trim() : ''),
  };
  return { bible, beats };
}
