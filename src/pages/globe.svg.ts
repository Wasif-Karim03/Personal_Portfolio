/**
 * The FIG. 04 globe's fixed layers (sphere, land, graticule) as one static,
 * cacheable SVG, instead of ~50 KB of path data inline in the page. The route
 * and its markers stay inline in SceneFlight, where the scroll moves them.
 *
 * An SVG loaded through <img> can't see the page's CSS, so its colours are
 * mixed here from the same tokens, read from src/styles/tokens.css.
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import { flight } from '../data/flight';

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`--${name} isn't a six-digit hex colour in tokens.css`);
  return match[1];
}

/** color-mix(in srgb, ink share%, paper), as the page's --ink-NN tokens are defined. */
function mix(ink: string, paper: string, share: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(channel(ink, i) * share + channel(paper, i) * (1 - share)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

const paper = token('paper');
const ink = token('ink');
const ink12 = mix(ink, paper, 0.12);
const ink30 = mix(ink, paper, 0.3);

export const GET: APIRoute = () =>
  new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${flight.size} ${flight.size}">` +
      `<path d="${flight.sphere}" fill="${paper}" stroke="${ink30}" stroke-width="1.5"/>` +
      `<path d="${flight.land}" fill="${ink12}" stroke="${ink30}" stroke-width="0.75"/>` +
      `<path d="${flight.graticule}" fill="none" stroke="${ink30}" stroke-width="0.6" opacity="0.5"/>` +
      `</svg>`,
    { headers: { 'Content-Type': 'image/svg+xml' } },
  );
