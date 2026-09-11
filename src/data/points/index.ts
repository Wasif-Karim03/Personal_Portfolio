/**
 * Point clouds for FIG. 14, validated at build time.
 *
 * scripts/make-lidar-placeholder.mjs, or scripts/ply-to-points.mjs for a real
 * scan, writes each manifest into this folder and the points into
 * public/points/. This module fails the build if a manifest is malformed or its
 * files don't hold the number of points it claims, the same guard the frame
 * sequences have.
 *
 * Build-time only: it reads the filesystem, so client code must import the type
 * from src/lib/point-flight.ts, never from here.
 */
/// <reference types="node" />
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { PointCloudManifest } from '../../lib/point-flight';
import workJson from './work.json';

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const cloud = z.object({ file: z.string().startsWith('/'), count: z.number().int().positive() });

const manifestSchema = z.object({
  name: z.string().min(1),
  source: z.enum(['placeholder', 'scan']),
  caption: z.string().min(1),
  desktop: cloud,
  mobile: cloud,
  bounds: z.object({ min: vec3, max: vec3 }),
  path: z.array(vec3).min(2),
});

/** float32 x, y, z: twelve bytes a point. */
const BYTES_PER_POINT = 12;

function loadPoints(json: unknown): PointCloudManifest {
  const manifest = manifestSchema.parse(json);
  const problems: string[] = [];

  for (const key of ['desktop', 'mobile'] as const) {
    const { file, count } = manifest[key];
    const path = join(process.cwd(), 'public', file);
    if (!existsSync(path)) {
      problems.push(`${key}: ${file} is missing`);
    } else if (statSync(path).size !== count * BYTES_PER_POINT) {
      problems.push(`${key}: ${file} holds ${statSync(path).size / BYTES_PER_POINT} points, manifest says ${count}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Point cloud "${manifest.name}" does not match its files:\n  ${problems.join('\n  ')}\n` +
        'Re-run scripts/ply-to-points.mjs, or scripts/make-lidar-placeholder.mjs.',
    );
  }
  return manifest;
}

export const workPoints = loadPoints(workJson);
