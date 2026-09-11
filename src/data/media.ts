/**
 * Photo and clip slots for the scenes that show pictures (FIG. 03, 05, 06, 11, 12).
 *
 * Every slot has its place on the page from the start. Until its file exists it
 * renders as a labelled empty frame on the sheet.
 *
 * Anything Wasif didn't shoot himself carries a credit, shown under it as a
 * caption: a photographer and licence, or that it was generated. The colophon
 * lists every credit too.
 *
 * Filling a slot is one command, no code:
 *   node scripts/add-photo.mjs ~/Pictures/letter.jpg accepted-letter
 *   scripts/add-clip.sh ~/Movies/printer.mov thinkbox-printer
 * A photo lands in src/assets/media/<id>.jpg and is picked up here by name; a
 * clip lands in public/media/<id>.mp4 beside a <id>.jpg poster.
 *
 * Build-time only: it reads the filesystem, and fails the build on a media file
 * whose name matches no slot, which would otherwise leave the slot empty
 * without a word.
 */
/// <reference types="node" />
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ImageMetadata } from 'astro';

export type SlotKind = 'photo' | 'clip';

export interface MediaSlot {
  id: string;
  kind: SlotKind;
  /** What belongs here, shown on the empty frame until it arrives. */
  wanted: string;
  /**
   * Alt text for the real photo or clip. Written ahead of it, so check it
   * against what actually arrives.
   */
  alt: string;
  /** Frame proportions, width / height, so nothing shifts when media arrives. */
  aspect: [number, number];
  /** For media Wasif didn't shoot. Shown as the caption and in the colophon. */
  credit?: Credit;
}

export interface Credit {
  /** The caption, e.g. "Photo: Jane Doe, CC BY-SA 4.0". */
  text: string;
  /** Where the original lives, for a photo used under licence. */
  source?: string;
  license?: { name: string; url: string };
}

/** A Wikimedia Commons photo used under its Creative Commons licence. */
const commons = (author: string, license: 'CC BY-SA 3.0' | 'CC BY-SA 4.0', file: string): Credit => ({
  text: `Photo: ${author}, ${license}`,
  source: `https://commons.wikimedia.org/wiki/File:${file}`,
  license: {
    name: license,
    url: `https://creativecommons.org/licenses/by-sa/${license.endsWith('4.0') ? '4.0' : '3.0'}/`,
  },
});

/** A clip generated for the site, with no real counterpart. */
const generatedVideo: Credit = { text: 'AI-generated video' };

export interface ResolvedSlot extends MediaSlot {
  photo?: ImageMetadata;
  clip?: { src: string; poster: string };
}

const slots: MediaSlot[] = [
  // FIG. 03
  {
    id: 'accepted-letter',
    kind: 'photo',
    aspect: [4, 3],
    wanted: 'The 2022 acceptance letter, close up',
    alt: 'The Ohio Wesleyan University acceptance letter, 2022, awarding the Schubert Scholarship.',
  },
  // FIG. 04, AI-1 to AI-3. SceneFlight shows only the ones that exist, so a shot
  // stays off the page until its file is added (AI-1 needs Wasif's approval).
  {
    id: 'flight-gate',
    kind: 'clip',
    aspect: [16, 9],
    wanted: 'AI-1: an airport gate window before dawn',
    alt: 'A traveller seen from behind at an airport gate window before dawn, an airliner beyond.',
    credit: generatedVideo,
  },
  {
    id: 'flight-window',
    kind: 'clip',
    aspect: [16, 9],
    wanted: 'AI-2: the window seat at sunrise',
    alt: 'The view from a window seat: the wing over clouds lit by sunrise, the ocean below.',
    credit: generatedVideo,
  },
  {
    id: 'flight-descent',
    kind: 'clip',
    aspect: [16, 9],
    wanted: 'AI-3: descending over Ohio',
    alt: 'Descending over green summer farmland in Ohio.',
    credit: generatedVideo,
  },
  // FIG. 05. Wasif's own campus photos can replace these at any time.
  {
    id: 'campus-1',
    kind: 'photo',
    aspect: [3, 2],
    wanted: 'Ohio Wesleyan, wide',
    alt: 'University Hall at Ohio Wesleyan, a sandstone building with a tall square tower, behind trees on the lawn.',
    credit: commons('Christopher L. Riley', 'CC BY-SA 4.0', 'University_Hall_—_Delaware,_Ohio.jpg'),
  },
  {
    id: 'campus-2',
    kind: 'photo',
    aspect: [4, 5],
    wanted: 'Ohio Wesleyan, a detail',
    alt: 'Stuyvesant Hall at Ohio Wesleyan, red brick with a white cupola, framed by trees against a blue sky.',
    credit: commons('Phillip M. Kukelhan', 'CC BY-SA 3.0', '2012sept_WesleyanUniversityStuyvesantHall001.jpg'),
  },
  {
    id: 'campus-3',
    kind: 'photo',
    aspect: [3, 2],
    wanted: 'Ohio Wesleyan, day to day',
    alt: "The Ohio Wesleyan Student Observatory, a brick building with a round tower under a metal dome.",
    credit: commons('Christopher L. Riley', 'CC BY-SA 4.0', 'OWU_Student_Observatory_—_Delaware,_Ohio.jpg'),
  },
  // FIG. 06
  { id: 'club-1', kind: 'photo', aspect: [4, 3], wanted: 'A build event', alt: 'OWU Robotics Club members at a build event.' },
  { id: 'club-2', kind: 'photo', aspect: [4, 3], wanted: 'A competition', alt: 'The OWU Robotics Club at a competition.' },
  { id: 'club-3', kind: 'photo', aspect: [4, 3], wanted: 'The club, together', alt: 'The OWU Robotics Club.' },
  // FIG. 11
  { id: 'graduation', kind: 'photo', aspect: [4, 5], wanted: 'Graduation day, May 2026', alt: 'Wasif Karim in a graduation cap and gown with a blue stole and honor cords, smiling beside a stone pillar in front of a campus building.' },
  // FIG. 12
  {
    id: 'thinkbox-printer',
    kind: 'clip',
    aspect: [1, 1],
    wanted: 'The volumetric printer curing a part in one rotation',
    alt: 'The volumetric resin printer curing a part as the resin turns.',
  },
  {
    id: 'thinkbox-poetry-camera',
    kind: 'clip',
    aspect: [1, 1],
    wanted: 'Poetry Camera printing a poem',
    alt: 'Poetry Camera printing a poem.',
  },
];

const known = new Map(slots.map((s) => [s.id, s]));

const PHOTO_DIR = '/src/assets/media/';
const photoFiles = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/media/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

const clipDir = join(process.cwd(), 'public/media');
const clipIds = existsSync(clipDir)
  ? readdirSync(clipDir).filter((f) => f.endsWith('.mp4')).map((f) => f.slice(0, -'.mp4'.length))
  : [];

const photos = new Map<string, ImageMetadata>();
const problems: string[] = [];

for (const [path, module] of Object.entries(photoFiles)) {
  const file = path.slice(PHOTO_DIR.length);
  const id = file.replace(/\.[^.]+$/, '');
  const slot = known.get(id);
  if (!slot) problems.push(`src/assets/media/${file}: no slot called "${id}"`);
  else if (slot.kind !== 'photo') problems.push(`src/assets/media/${file}: "${id}" is a clip slot`);
  else if (photos.has(id)) problems.push(`src/assets/media/${file}: "${id}" already has a photo`);
  else photos.set(id, module.default);
}

for (const id of clipIds) {
  const slot = known.get(id);
  if (!slot) problems.push(`public/media/${id}.mp4: no slot called "${id}"`);
  else if (slot.kind !== 'clip') problems.push(`public/media/${id}.mp4: "${id}" is a photo slot`);
  else if (!existsSync(join(clipDir, `${id}.jpg`))) problems.push(`public/media/${id}.mp4: no ${id}.jpg poster beside it`);
}

if (problems.length > 0) {
  throw new Error(`Media files don't match their slots in src/data/media.ts:\n  ${problems.join('\n  ')}`);
}

/** Every slot with a credit that has its media, for the colophon. */
export function credited(): ResolvedSlot[] {
  return slots.map((s) => slot(s.id)).filter((s) => s.credit && (s.photo || s.clip));
}

/** A slot, with its photo or clip if one has been added. */
export function slot(id: string): ResolvedSlot {
  const base = known.get(id);
  if (!base) throw new Error(`No media slot called "${id}" in src/data/media.ts`);
  return {
    ...base,
    photo: photos.get(id),
    clip: clipIds.includes(id) ? { src: `/media/${id}.mp4`, poster: `/media/${id}.jpg` } : undefined,
  };
}
