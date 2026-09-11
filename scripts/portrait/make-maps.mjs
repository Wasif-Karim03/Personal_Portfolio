#!/usr/bin/env node
/**
 * Turns a real photo of Wasif into the maps a point-cloud portrait is built
 * from. Everything runs on this machine: the models' weights download from the
 * Hugging Face hub once, and the photo itself never leaves the computer.
 *
 *   cd scripts/portrait && npm install      (once)
 *   node scripts/portrait/make-maps.mjs <photo> <name>
 *   e.g. node scripts/portrait/make-maps.mjs assets/raw/real/face/DSC01197.jpg graduation
 *
 * Writes assets/raw/derived/<name>/ (kept out of git, like the photos):
 *   photo.jpg       the photo, upright, fitted within 1600px
 *   depth.png       relative depth, Depth Anything V2 (small); brighter is nearer
 *   matte.png       the person cut from the background, MODNet
 *   detection.json  the detector's box and confidence for the person, DETR
 *
 * Then scripts/make-clouds.mjs turns them into the cloud the site loads.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, RawImage } from '@huggingface/transformers';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [input, name] = process.argv.slice(2);
if (!input || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('usage: make-maps.mjs <photo> <name>   (name: lowercase letters, digits, dashes)');
  process.exit(1);
}

const out = join(root, 'assets/raw/derived', name);
mkdirSync(out, { recursive: true });

// Upright and a workable size first, so all three maps share one frame.
const photoPath = join(out, 'photo.jpg');
await sharp(resolve(input)).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 92 }).toFile(photoPath);
const image = await RawImage.read(photoPath);
console.log(`make-maps: ${name}, ${image.width}x${image.height}`);

const depth = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'fp32' });
const { depth: depthMap } = await depth(image);
await depthMap.save(join(out, 'depth.png'));
console.log('  depth.png');

const removeBackground = await pipeline('background-removal', 'Xenova/modnet', { dtype: 'fp32' });
let cut = await removeBackground(image);
if (Array.isArray(cut)) cut = cut[0];
// Keep only the alpha: the matte, not a second copy of the photo.
await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: cut.channels } })
  .extractChannel(cut.channels - 1).png().toFile(join(out, 'matte.png'));
console.log('  matte.png');

const detect = await pipeline('object-detection', 'Xenova/detr-resnet-50', { dtype: 'fp32' });
const found = (await detect(image, { threshold: 0.5 })).filter((d) => d.label === 'person');
found.sort((a, b) => (b.box.xmax - b.box.xmin) * (b.box.ymax - b.box.ymin) - (a.box.xmax - a.box.xmin) * (a.box.ymax - a.box.ymin));
if (found.length === 0) console.warn('  no person detected; the portrait will have no detection box');
const person = found[0];
writeFileSync(join(out, 'detection.json'), JSON.stringify({
  model: 'Xenova/detr-resnet-50',
  width: image.width,
  height: image.height,
  person: person ? { score: Number(person.score.toFixed(3)), box: person.box } : null,
}, null, 2) + '\n');
console.log(`  detection.json${person ? `: person ${person.score.toFixed(2)}` : ''}`);
