/**
 * Where a scene is in its scroll, measured one way everywhere: the point cloud,
 * the flight readout and the rewind timecode all use this, so they agree.
 *
 * A scene becomes current when its top reaches the settle line: a third of the
 * way down a wide screen, or the bottom edge of the cloud panel on a narrow one
 * (CloudStage.astro). The next scene's cloud starts forming at the enter line.
 * Client-safe: it imports nothing.
 */

/** Wide screens put the cloud beside the text; narrow ones above it. */
export const WIDE = '(min-width: 60rem)';

export function scrollLines(vh = window.innerHeight): { settle: number; enter: number } {
  const wide = window.matchMedia(WIDE).matches;
  // A short window between the two, so a shape holds while its scene is read
  // and changes briskly between scenes, rather than lingering half-formed.
  return { settle: vh * (wide ? 0.3 : 0.5), enter: vh * (wide ? 0.7 : 0.8) };
}

/** 0 as a scene settles, 1 once it has scrolled through. */
export function sceneProgress(rect: DOMRect, vh = window.innerHeight): number {
  const { settle } = scrollLines(vh);
  return Math.min(Math.max((settle - rect.top) / Math.max(rect.height - vh * 0.7, vh * 0.3), 0), 1);
}
