/**
 * timeline.js — the single scrubbed master timeline.
 *
 * The timeline is 100 units long, so positions read as % of the pinned scroll:
 *   0–14   hero leaves (blur + lift)
 *   4–92   video walks through the scene (currentTime 0 → end)
 *   20–72  four story chapters, each with its own in / hold / out window
 *   74–90  project showcase builds in, holds until 100
 *   100    pin releases, footer scrolls in
 */
import { splitWords } from './split.js';

const CHAPTER_WINDOWS = [
  // [in, out]
  [20, 30],
  [33, 44],
  [47, 57],
  [60, 69],
];

const HUD_LABELS = [
  [0, '00 — Abertura'],
  [18, '01 — Chegada'],
  [32, '02 — Resultados'],
  [46, '03 — Ofício'],
  [59, '04 — Horizonte'],
  [72, '05 — Projetos'],
];

export function buildTimeline({ gsap, ScrollTrigger, scene, stage, scrub }) {
  const q = (sel) => stage.querySelector(sel);
  const qa = (sel) => [...stage.querySelectorAll(sel)];

  const hero = q('[data-hero]');
  const videoEl = q('[data-scrub-video]');
  const veil = q('[data-veil]');
  const chapters = qa('[data-chapter]');
  const work = q('[data-work]');
  const workTitle = splitWords(work.querySelector('[data-split]'));
  const cards = qa('[data-card]');
  const hudFill = q('[data-hud-fill]');
  const hudLabel = q('[data-hud-label]');
  const hudTime = q('[data-hud-time]');

  // Initial states (explicit, so reverse-scrubbing restores them exactly)
  gsap.set(chapters, { autoAlpha: 0 });
  gsap.set(work, { autoAlpha: 0 });

  const isMobile = window.matchMedia('(max-width: 720px)').matches;
  const pinLength = () => window.innerHeight * (isMobile ? 5 : 6);

  // Animated blur repaints/re-filters big text layers every frame. Keep it for
  // desktop-class devices only; phones/tablets get the same move without it.
  const useBlur = !isMobile && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (useBlur) document.documentElement.classList.add('fx-blur');
  const blur = (px) => (useBlur ? { filter: `blur(${px}px)` } : {});

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: scene,
      start: 'top top',
      end: () => `+=${pinLength()}`,
      pin: stage,
      // Lenis already smooths the wheel and the canvas blends between frames, so a
      // short catch-up is enough; 1.2 stacked on top of both felt laggy (~0.26 s behind).
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateHud(self.progress),
    },
  });

  /* ---------- video: proxy tween -> ScrubVideo target ---------- */
  const proxy = { p: 0 };
  tl.fromTo(proxy, { p: 0 }, {
    p: 1,
    duration: 88,
    onUpdate: () => scrub && scrub.setProgress(proxy.p),
  }, 4);
  const surfaces = [videoEl, scrub?.canvas].filter(Boolean);   // <canvas> renderer + <video> fallback
  tl.fromTo(surfaces, { scale: 1.14 }, { scale: 1, duration: 26, ease: 'power2.out' }, 0);

  /* ---------- 1. hero out ---------- */
  tl.to(hero, { yPercent: -18, autoAlpha: 0, ...blur(10), duration: 13, ease: 'power2.in' }, 1);
  tl.to(q('[data-scroll-cue]'), { autoAlpha: 0, duration: 3 }, 0);

  /* ---------- 2. story chapters ---------- */
  // Dim the footage a little so overlay copy stays readable over bright sky/sea.
  tl.fromTo(veil, { backgroundColor: 'rgba(13,13,11,0)' }, { backgroundColor: 'rgba(13,13,11,0.3)', duration: 5 }, 15);
  chapters.forEach((ch, i) => {
    const [tin, tout] = CHAPTER_WINDOWS[i] ?? [20 + i * 12, 30 + i * 12];
    const words = splitWords(ch.querySelector('[data-split]'));
    const extras = [...ch.querySelectorAll('.chapter__index, .chapter__body, .metric')];

    tl.fromTo(ch, { autoAlpha: 0, ...blur(12) }, { autoAlpha: 1, ...blur(0), duration: 4, ease: 'power2.out' }, tin);
    tl.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 4, stagger: 0.35, ease: 'power3.out' }, tin);
    tl.fromTo(extras, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 3, stagger: 0.5, ease: 'power2.out' }, tin + 1.5);

    // Number counters ride the scrub too
    ch.querySelectorAll('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const pre = el.dataset.prefix || '';
      const suf = el.dataset.suffix || '';
      const o = { v: 0 };
      tl.fromTo(o, { v: 0 }, {
        v: end, duration: 5, ease: 'power2.out',
        onUpdate: () => { el.textContent = `${pre}${o.v.toFixed(dec)}${suf}`; },
      }, tin + 1);
    });

    tl.to(ch, { autoAlpha: 0, ...blur(10), y: -40, duration: 3, ease: 'power2.in' }, tout);
  });

  /* ---------- 3. showcase ---------- */
  tl.to(veil, { backgroundColor: 'rgba(13,13,11,0.5)', duration: 6 }, 70);  tl.fromTo(work, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 74);
  tl.fromTo(workTitle, { yPercent: 115 }, { yPercent: 0, duration: 4, stagger: 0.5, ease: 'power3.out' }, 74);
  tl.fromTo(work.querySelector('.eyebrow'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 3 }, 74);
  tl.fromTo(cards,
    { y: () => window.innerHeight * 0.5, autoAlpha: 0, rotation: (i) => (i % 2 ? 4 : -4) },
    { y: 0, autoAlpha: 1, rotation: 0, duration: 8, stagger: 1.4, ease: 'power3.out' },
    76);
  // hold until 100 so the cards stay readable before the pin releases
  tl.to({}, { duration: 1 }, 99);

  /* ---------- HUD ---------- */
  function updateHud(progress) {
    hudFill.style.transform = `scaleX(${progress.toFixed(4)})`;
    const pct = progress * 100;
    let label = HUD_LABELS[0][1];
    for (const [at, text] of HUD_LABELS) if (pct >= at) label = text;
    if (hudLabel.textContent !== label) hudLabel.textContent = label;
  }
  if (scrub) {
    let lastHud = '';
    gsap.ticker.add(() => {
      const txt = `${scrub.time.toFixed(2)}s`;
      if (txt !== lastHud) { hudTime.textContent = txt; lastHud = txt; }   // no DOM write when idle
    });
  }

  return tl;
}
