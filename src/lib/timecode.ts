/**
 * Timecode formatting for FIG. 02's rewind, shared by the server render and the
 * scroll-driven readout. Client-safe: it imports nothing.
 */

/** Frames per second the frame field counts in, as on a film timecode. */
export const TIMECODE_FPS = 24;

const two = (value: number) => String(value).padStart(2, '0');

/**
 * "2022.08.10" and "00:00:00:00" for a moment in time plus a running frame
 * count. UTC throughout, so the server render and the browser always agree.
 */
export function timecode(ms: number, frame: number): { day: string; clock: string } {
  const date = new Date(ms);
  const day = `${date.getUTCFullYear()}.${two(date.getUTCMonth() + 1)}.${two(date.getUTCDate())}`;
  const clock = [
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    frame % TIMECODE_FPS,
  ]
    .map(two)
    .join(':');
  return { day, clock };
}
