/**
 * Motion foundation: GSAP plugin registration plus Lenis smooth scroll.
 *
 * Two non-negotiables from docs/storyboard.md are enforced here rather than
 * left to each scene:
 *
 *   1. Scroll speed is never taken over. Lenis smooths the wheel, but nothing
 *      here snaps, paginates, or drives scroll position. Animations follow the
 *      scroll; they do not control it.
 *   2. prefers-reduced-motion gets a calm, static version. Under that setting
 *      neither GSAP nor Lenis starts at all, so scenes render as plain markup.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import Lenis from 'lenis';

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin };

/** True when the visitor asked for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

let initialised = false;
let lenis: Lenis | null = null;

/**
 * Boots motion once per page load. Safe to call from any scene; later calls are
 * no-ops. Returns false when motion is suppressed, so a scene can take its
 * static path instead of animating.
 */
export function initMotion(): boolean {
  if (initialised) return lenis !== null;
  initialised = true;

  if (prefersReducedMotion()) return false;

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin);

  lenis = new Lenis({
    // Smoothing only. No wheel multiplier games, no snapping.
    duration: 1.1,
    smoothWheel: true,
    // Touch scrolling stays native; smoothing it fights the platform.
    syncTouch: false,
  });

  // Drive Lenis from GSAP's ticker so scroll and tweens share one clock.
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return true;
}

/** The Lenis instance, or null under reduced motion. */
export function getLenis(): Lenis | null {
  return lenis;
}

/**
 * Registers a scene's animation. The callback runs only when motion is on, and
 * gets a GSAP context scoped to `root` so every tween and ScrollTrigger it
 * creates is cleaned up together.
 */
export function scene(
  root: Element,
  build: (ctx: gsap.Context) => void,
): () => void {
  if (!initMotion()) return () => {};

  const ctx = gsap.context((self) => build(self), root);
  return () => ctx.revert();
}
