/**
 * Photo and clip slots for the REAL scenes (FIG. 03, 05, 06, 11, 12).
 *
 * Every slot has its place on the page from the start. Until its file exists it
 * renders as a labelled empty frame on the sheet, never a stand-in picture:
 * these scenes are the proof, so nothing else goes in them.
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
}

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
  // FIG. 05
  { id: 'campus-1', kind: 'photo', aspect: [3, 2], wanted: 'Ohio Wesleyan, wide', alt: 'The Ohio Wesleyan University campus.' },
  { id: 'campus-2', kind: 'photo', aspect: [4, 5], wanted: 'Ohio Wesleyan, a detail', alt: 'The Ohio Wesleyan University campus.' },
  { id: 'campus-3', kind: 'photo', aspect: [3, 2], wanted: 'Ohio Wesleyan, day to day', alt: 'The Ohio Wesleyan University campus.' },
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
