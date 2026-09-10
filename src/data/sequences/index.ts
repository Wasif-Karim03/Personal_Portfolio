/**
 * Image sequences for the scrub scenes, validated at build time.
 *
 * scripts/extract-frames.sh writes each manifest into this folder and the
 * frames into public/sequences/. Swapping placeholder frames for real footage
 * means re-running that script. This module then fails the build if a manifest
 * is malformed or does not match the frame files on disk, instead of letting a
 * scrub stall on missing frames in production.
 *
 * Build-time only: it reads the filesystem, so client code must import types
 * from src/lib/frames.ts, never from here.
 */
/// <reference types="node" />
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { DetectionTrack, SequenceManifest } from '../../lib/frames';
import heroJson from './hero.json';
import heroDetectionsJson from './hero.detections.json';

const variantSchema = z.object({
  count: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pattern: z.string().includes('{i}'),
  pad: z.number().int().min(1),
});

const manifestSchema = z.object({
  name: z.string().min(1),
  source: z.enum(['placeholder', 'footage']),
  alt: z.string().min(1),
  desktop: variantSchema,
  mobile: variantSchema,
  poster: z.string().startsWith('/'),
  still: z.string().startsWith('/'),
});

const detectionTrackSchema = z.object({
  label: z.string().min(1),
  frames: z.array(
    z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]).nullable(),
  ),
});

const publicDir = join(process.cwd(), 'public');

function assertMatchesDisk(manifest: SequenceManifest): void {
  const problems: string[] = [];

  for (const key of ['desktop', 'mobile'] as const) {
    const variant = manifest[key];
    const dir = join(publicDir, dirname(variant.pattern));
    const onDisk = existsSync(dir)
      ? readdirSync(dir).filter((file) => !file.startsWith('.')).length
      : 0;
    if (onDisk !== variant.count) {
      problems.push(`${key}: manifest says ${variant.count} frames, ${dir} has ${onDisk}`);
    }
  }

  for (const key of ['poster', 'still'] as const) {
    if (!existsSync(join(publicDir, manifest[key]))) {
      problems.push(`${key}: ${manifest[key]} is missing`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Sequence "${manifest.name}" does not match its frames on disk:\n  ` +
        `${problems.join('\n  ')}\nRe-run scripts/extract-frames.sh for it.`,
    );
  }
}

function loadSequence(json: unknown): SequenceManifest {
  const manifest = manifestSchema.parse(json);
  assertMatchesDisk(manifest);
  return manifest;
}

export const heroSequence = loadSequence(heroJson);
export const heroDetections: DetectionTrack = detectionTrackSchema.parse(heroDetectionsJson);
