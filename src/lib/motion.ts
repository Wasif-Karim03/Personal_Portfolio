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

  // Handy when debugging scroll behaviour in the dev server. Never in a build.
  if (import.meta.env.DEV) {
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
  }

  initAnchors();

  return true;
}

/**
 * Routes in-page anchor links through Lenis.
 *
 * A native hash jump bypasses Lenis: it lands instantly instead of smoothly,
 * and if Lenis is mid-animation it overwrites the jump and the page snaps back.
 * So #links, the skip link included, go through lenis.scrollTo instead.
 *
 * Lenis's own `anchors` option is not used: it does not prevent the native
 * jump, ignores modifier keys, never moves keyboard focus, and fixes its offset
 * at construction instead of measuring the nav.
 */
function initAnchors(): void {
  /** Clears the fixed nav so the target is not hidden underneath it. */
  const navOffset = () => {
    const nav = document.querySelector('header');
    return nav ? -(nav.getBoundingClientRect().height + 12) : -56;
  };

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.target && link.target !== '_self') return;

    // Same document, and actually pointing at a fragment.
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    if (!url.hash || url.hash === '#') return;

    const target = document.querySelector(url.hash);
    if (!target) return;

    event.preventDefault();
    lenis?.scrollTo(target as HTMLElement, { offset: navOffset() });
    history.pushState(null, '', url.hash);

    // Keyboard focus has to follow the scroll, or the skip link moves the view
    // without moving the user.
    const focusTarget = target as HTMLElement;
    if (!focusTarget.hasAttribute('tabindex')) {
      focusTarget.setAttribute('tabindex', '-1');
    }
    focusTarget.focus({ preventScroll: true });
  });

  // A URL that arrives with a hash needs the same treatment.
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) {
      requestAnimationFrame(() => {
        lenis?.scrollTo(target as HTMLElement, {
          offset: navOffset(),
          immediate: true,
        });
      });
    }
  }
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
