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
 *
 * Phones often write HEIC, sometimes under a .jpg name, and sharp can't decode
 * HEVC-coded HEIC. On macOS the file is converted through sips first.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
const convert = (from) =>
  sharp(from)
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(out);

let info;
try {
  info = await convert(input);
} catch (error) {
  if (process.platform !== 'darwin') die(`couldn't read ${input}: ${error.message}`);
  // Most likely HEIC: macOS's sips can decode it, so go through a temporary JPEG.
  const dir = mkdtempSync(join(tmpdir(), 'add-photo-'));
  try {
    const converted = join(dir, 'converted.jpg');
    execFileSync('sips', ['-s', 'format', 'jpeg', input, '--out', converted], { stdio: 'ignore' });
    info = await convert(converted);
    console.log('  read through macOS sips (sharp could not decode it; probably HEIC)');
  } catch {
    die(`couldn't read ${input}: ${error.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`add-photo: ${slot} from ${input}`);
console.log(`  ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB, metadata removed`);
console.log(`  src/assets/media/${slot}.jpg; check the slot's alt text in src/data/media.ts`);
