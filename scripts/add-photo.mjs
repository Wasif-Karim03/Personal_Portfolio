#!/usr/bin/env node
/**
 * Adds a real photo to one of the media slots in src/data/media.ts.
 *
 *   node scripts/add-photo.mjs <photo> <slot>
 *   e.g. node scripts/add-photo.mjs ~/Pictures/IMG_2041.jpg accepted-letter
 *
 * Turns it upright from its EXIF orientation, fits it within 2400px and writes
 * src/assets/media/<slot>.jpg; the build makes the responsive sizes and formats
 * from that. Metadata is dropped on the way, including any GPS location a phone
 * wrote into the file.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function die(message) {
  console.error(`add-photo: ${message}`);
  process.exit(1);
}

const [input, slot] = process.argv.slice(2);
if (!input || !slot) die('usage: add-photo.mjs <photo> <slot>');
if (!/^[a-z0-9-]+$/.test(slot)) die(`slot names are lowercase letters, digits and dashes: ${slot}`);

const out = join(root, 'src/assets/media', `${slot}.jpg`);
mkdirSync(dirname(out), { recursive: true });

// sharp writes no metadata unless asked to, so EXIF (and its GPS block) is gone.
const info = await sharp(input)
  .rotate()
  .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile(out)
  .catch((error) => die(`couldn't read ${input}: ${error.message}`));

console.log(`add-photo: ${slot} from ${input}`);
console.log(`  ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB, metadata removed`);
console.log(`  src/assets/media/${slot}.jpg; check the slot's alt text in src/data/media.ts`);
