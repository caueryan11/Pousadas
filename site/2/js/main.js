/**
 * main.js — bootstraps the page.
 *
 * Progressive enhancement:
 *  - No JS / CDN blocked / prefers-reduced-motion → static, readable layout
 *    (html without .is-scrub). The video shows a still frame behind the text.
 *  - Otherwise → Lenis smooth scroll + pinned GSAP ScrollTrigger timeline
 *    with the video scrubbed by scroll (html.is-scrub).
 *
 * The video file itself is chosen in index.html (<source> tags) — swap it there.
 */
import { ScrubVideo } from './scrub-video.js';
import { buildTimeline } from './timeline.js';
import { initCards } from './cards.js';
import { splitWords } from './split.js';

const root = document.documentElement;
const { gsap, ScrollTrigger, Lenis } = window;

// `?static` in the URL previews the reduced-motion layout without changing OS settings.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  || new URLSearchParams(location.search).has('static');
const scene = document.querySelector('.scene');
const stage = document.querySelector('[data-stage]');
const videoEl = document.querySelector('[data-scrub-video]');

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- video (shared by both modes) ---------- */
const markNoVideo = () => root.classList.add('no-video');

if (!gsap || !ScrollTrigger || reducedMotion) {
  /* ===== STATIC MODE ===== */
  // Show one calm frame from the middle of the walk instead of frame 0.
  // ScrubVideo is reused only for loading (blob → seekable even on servers
  // without HTTP Range support) and for error handling; nothing is animated.
  const showStill = () => {
    if (Number.isFinite(videoEl.duration)) videoEl.currentTime = videoEl.duration * 0.35;
  };
  new ScrubVideo(videoEl, { onFail: markNoVideo, prime: false });
  videoEl.addEventListener('loadeddata', showStill);
  if (videoEl.readyState >= 2) showStill();
  if (!gsap) console.warn('[saltline] GSAP not available — running static layout.');
} else {
  /* ===== SCRUB MODE ===== */
  gsap.registerPlugin(ScrollTrigger);
  root.classList.add('is-scrub');

  // 1. Smooth scroll (Lenis) driven by GSAP's ticker so everything shares one rAF.
  let lenis = null;
  if (Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // 2. Video scrubber — draws blended frames on a <canvas> (smoothest).
  //    `?video` in the URL forces the old currentTime renderer for comparison.
  const scrub = new ScrubVideo(videoEl, {
    mode: new URLSearchParams(location.search).has('video') ? 'video' : 'canvas',
    ease: 0.2,
    onReady: () => ScrollTrigger.refresh(),
    onFail: (err) => {
      console.warn('[saltline] video failed, using gradient fallback.', err);
      markNoVideo();
    },
  });
  scrub.start();

  // 3. Hero intro (time-based, plays once on load)
  const heroWords = splitWords(document.querySelector('.hero__title'));
  gsap.from(heroWords, { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
  gsap.from('.hero__eyebrow, .hero__foot', { autoAlpha: 0, y: 20, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.5 });

  // 4. Scroll timeline
  const tl = buildTimeline({ gsap, ScrollTrigger, scene, stage, scrub });

  // 5. Card micro-interactions
  initCards([...document.querySelectorAll('[data-card]')], { gsap });

  // 6. In-page anchors map onto timeline positions inside the pin
  const st = tl.scrollTrigger;
  const ANCHORS = { '#top': 0, '#story': 0.235, '#work': 0.9 };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    let y = null;
    if (hash in ANCHORS) y = st.start + (st.end - st.start) * ANCHORS[hash];
    else if (hash.length > 1) {
      const target = document.querySelector(hash);
      if (target) y = target.getBoundingClientRect().top + window.scrollY;
    }
    if (y === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
    // move keyboard focus to the destination for screen-reader / keyboard users
    const focusTarget = hash === '#top' ? document.querySelector('.brand') : document.querySelector(hash);
    if (focusTarget) {
      if (!focusTarget.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT)$/.test(focusTarget.tagName)) focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
  });

  // Keyboard users tabbing into the pinned cards: jump the scroll so they're visible.
  document.querySelectorAll('.card__link').forEach((link) => {
    link.addEventListener('focus', () => {
      if (tl.progress() < 0.86) {
        const y = st.start + (st.end - st.start) * 0.9;
        lenis ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
      }
    });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());

  // Expose for debugging in the console
  window.__saltline = { tl, scrub, lenis };
}
