/* THE EXPEDITION SERIES · orchestration
 * One ticker (gsap.ticker) drives Lenis, ScrollTrigger, the scrubber (canvas image sequence,
 * or the legacy <video> as fallback), the HUD and the preloader.
 */
import { loadFootage, primeVideo, pickFrameSet, loadManifest, createFrameStore } from './loader.js';
import { createScrubber, createCanvasRenderer, createVideoRenderer } from './scrub.js';
import { createHud } from './hud.js';
import { splitWords, initMagnetic, initDashboard, initLocale } from './ui.js';

const VIDEO_FPS = 24; // legacy scrub.mp4
const CHAPTERS = [
  { id: 'ch-1', a: 0.33, b: 0.53 },
  { id: 'ch-2', a: 0.56, b: 0.75 },
  { id: 'ch-3', a: 0.79, b: 0.985 },
];

boot();

function boot() {
  const { gsap, ScrollTrigger } = window;
  const body = document.body;
  const preloader = document.getElementById('preloader');

  if (!gsap || !ScrollTrigger) {
    // Libraries unavailable (offline CDN): show a static poster page rather than a black screen.
    console.error('[expedition] GSAP/ScrollTrigger missing, static fallback');
    body.classList.remove('is-loading');
    body.classList.add('no-libs');
    preloader && preloader.remove();
    document.querySelectorAll('.chapter').forEach((c) => { c.style.visibility = 'visible'; });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const mq = (q) => window.matchMedia(q).matches;
  const reduced = mq('(prefers-reduced-motion: reduce)');
  const isMobile = mq('(max-width: 820px)');
  const finePointer = mq('(hover: hover) and (pointer: fine)');

  /* ---------- elements ---------- */
  const stage = document.getElementById('stage');
  const media = document.getElementById('stage-media');
  const video = document.getElementById('scrub-video');
  const canvas = document.getElementById('scrub-canvas');
  const stills = [...document.querySelectorAll('#stage-stills img')];
  const hero = document.getElementById('hero');
  const heroLines = hero.querySelectorAll('.line__in');
  const heroMeta = [hero.querySelector('.hero__eyebrow'), hero.querySelector('.hero__lede'), hero.querySelector('.scroll-cue')];
  const hudEl = document.getElementById('hud');
  const specs = document.getElementById('specs');
  const navLinks = [...document.querySelectorAll('.masthead__nav a')];
  const progressBar = document.getElementById('page-progress');
  const plPct = document.getElementById('pl-pct');
  const plBytes = document.getElementById('pl-bytes');
  const plStatus = document.getElementById('pl-status');
  const plSr = document.getElementById('pl-sr');
  const plRing = preloader.querySelector('.radar__progress');

  const chapters = CHAPTERS.map((c) => {
    const el = document.getElementById(c.id);
    const words = splitWords(el.querySelector('[data-split]'));
    return { ...c, el, words, meta: [el.querySelector('.chapter__index'), el.querySelector('.chapter__body')] };
  });

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    lenis.stop();
  }

  /* ---------- scrub + hud ---------- */
  const scrub = createScrubber({ smoothTime: 0.16, reduced });
  const hud = createHud(hudEl, { fps: VIDEO_FPS });
  let footage = 'pending'; // 'frames' | 'video' | 'stills'
  let store = null;
  let renderer = null;

  const stageLen = () => Math.max(1, stage.offsetHeight - 2 * window.innerHeight);

  ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${stageLen()}`,
    invalidateOnRefresh: true,
    onUpdate: (self) => scrub.setTarget(self.progress),
  });

  /* ---------- nav targets ---------- */
  const targets = () => {
    const len = stageLen();
    return {
      0: 0,
      ch1: Math.round(len * ((CHAPTERS[0].a + CHAPTERS[0].b) / 2 - 0.04)),
      ch2: Math.round(len * ((CHAPTERS[1].a + CHAPTERS[1].b) / 2 - 0.03)),
      ch3: Math.round(len * ((CHAPTERS[2].a + CHAPTERS[2].b) / 2 - 0.03)),
      specs: specs.offsetTop,
    };
  };
  let cachedTargets = targets();
  let docMax = 1;
  ScrollTrigger.addEventListener('refresh', () => {
    cachedTargets = targets();
    docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  });

  const scrollToY = (y, opts = {}) => {
    if (lenis) lenis.scrollTo(y, { duration: 2.2, ...opts });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  };

  document.querySelectorAll('[data-scroll-to]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const key = a.dataset.scrollTo;
      if (key in cachedTargets) scrollToY(cachedTargets[key]);
    });
  });

  document.getElementById('replay').addEventListener('click', () => {
    if (!lenis) { window.scrollTo(0, 0); return; }
    lenis.scrollTo(0, { immediate: true, force: true });
    requestAnimationFrame(() => {
      lenis.scrollTo(cachedTargets.ch3 + Math.round(stageLen() * 0.08), {
        duration: 12,
        easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      });
    });
  });

  /* ---------- the one ticker ---------- */
  let lastNav = -1;
  let lastProg = '';
  let preloading = true;
  let realLoad = 0;
  let shownLoad = 0;
  let lastPct = -1;

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time, delta) => {
    const now = time * 1000;
    if (lenis) lenis.raf(now);
    const dt = delta / 16.667;

    if (preloading) {
      shownLoad += (realLoad - shownLoad) * Math.min(1, 0.09 * dt);
      if (realLoad - shownLoad < 0.001) shownLoad = realLoad;
      const pct = Math.floor(shownLoad * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        plPct.textContent = String(pct).padStart(3, '0');
        plRing.style.strokeDashoffset = String(1 - shownLoad);
      }
    }

    scrub.tick(dt, now);
    const p = scrub.progress;

    if (footage === 'stills') {
      const f = p * (stills.length - 1);
      for (let i = 0; i < stills.length; i++) {
        stills[i].style.opacity = String(Math.max(0, 1 - Math.abs(i - f)));
      }
      hud.update(p, Math.round(p * 191), 192, 8, VIDEO_FPS);
    } else {
      hud.update(p, scrub.frame, scrub.frames, scrub.duration, scrub.fps);
    }

    // page chrome (only touches the DOM when something changes)
    const y = window.scrollY;
    const prog = Math.min(1, y / docMax).toFixed(3);
    if (prog !== lastProg) {
      lastProg = prog;
      progressBar.style.transform = `scaleX(${prog})`;
    }
    let nav = 0;
    const sp = scrub.target;
    if (y >= cachedTargets.specs - window.innerHeight * 0.4) nav = 4;
    else if (sp >= CHAPTERS[2].a - 0.02) nav = 3;
    else if (sp >= CHAPTERS[1].a - 0.02) nav = 2;
    else if (sp >= CHAPTERS[0].a - 0.02) nav = 1;
    if (nav !== lastNav) {
      lastNav = nav;
      navLinks.forEach((a, i) => a.classList.toggle('is-active', i === nav));
    }
  });

  /* ---------- UI ---------- */
  if (finePointer && !reduced) initMagnetic(document.querySelectorAll('[data-magnetic]'));
  const dash = initDashboard(document.getElementById('dash'), { reduced });
  initLocale(document.querySelector('.locale'));

  // Specs + footer entrances (normal scroll, not scrubbed)
  gsap.from('.specs__head > *', {
    autoAlpha: 0, y: reduced ? 0 : 40, duration: 1.2, stagger: 0.08, ease: 'expo.out',
    scrollTrigger: { trigger: specs, start: 'top 55%', once: true },
  });
  gsap.from('#dash', {
    autoAlpha: 0, y: reduced ? 0 : 70, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: specs, start: 'top 45%', once: true, onEnter: () => dash.start() },
  });
  const sig = document.querySelector('.signature path');
  const sigLen = sig.getTotalLength();
  gsap.set(sig, { strokeDasharray: sigLen, strokeDashoffset: reduced ? 0 : sigLen });
  if (!reduced) {
    gsap.to(sig, {
      strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut',
      scrollTrigger: { trigger: '.finale', start: 'top 55%', once: true },
    });
  }
  gsap.from('.finale__title', {
    autoAlpha: 0, y: reduced ? 0 : 60, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: '.finale', start: 'top 70%', once: true },
  });

  /* ---------- story timeline (built after the intro so tweens never fight) ---------- */
  function buildStory() {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: () => `+=${stageLen()}`,
        scrub: reduced ? true : 0.4,
        invalidateOnRefresh: true,
      },
    });
    tl.set({}, {}, 1); // timeline length == 1 == footage progress

    if (!reduced) tl.fromTo(media, { scale: 1.12 }, { scale: 1, duration: 1 }, 0);

    // hero leaves as the SUV is locked and the drone dives (0.17 to 0.30)
    tl.to(heroMeta, { autoAlpha: 0, y: -24, duration: 0.06, stagger: 0.012 }, 0.17);
    tl.to(heroLines, { yPercent: -112, duration: 0.07, stagger: 0.016, ease: 'power2.in' }, 0.2);
    tl.set(hero, { autoAlpha: 0 }, 0.31);

    // legibility shades follow the side the copy sits on
    const shadeL = document.getElementById('shade-left');
    const shadeR = document.getElementById('shade-right');
    tl.to(shadeL, { opacity: 0, duration: 0.03 }, CHAPTERS[0].b);
    tl.fromTo(shadeR, { opacity: 0 }, { opacity: 1, duration: 0.03 }, CHAPTERS[1].a - 0.02);
    tl.to(shadeR, { opacity: 0, duration: 0.03 }, CHAPTERS[1].b);
    tl.to(shadeL, { opacity: 1, duration: 0.03 }, CHAPTERS[2].a - 0.02);

    // HUD comes online with the descent, goes dark before the spec sheet rises
    tl.fromTo(hudEl, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.06);
    tl.to(hudEl, { autoAlpha: 0, duration: 0.025 }, 0.97);

    chapters.forEach(({ el, words, meta, a, b }) => {
      tl.set(el, { visibility: 'visible' }, a);
      tl.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 0.05, stagger: 0.014, ease: 'power3.out' }, a);
      tl.fromTo(meta, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.05, stagger: 0.018, ease: 'power2.out' }, a + 0.012);
      tl.to(words, { yPercent: -115, duration: 0.04, stagger: 0.01, ease: 'power2.in' }, b - 0.055);
      tl.to(meta, { autoAlpha: 0, y: -20, duration: 0.035 }, b - 0.05);
      tl.set(el, { visibility: 'hidden' }, b);
    });
    ScrollTrigger.refresh();
  }

  /* ---------- preload + reveal ---------- */
  gsap.set(heroLines, { yPercent: 110 });
  gsap.set(heroMeta, { autoAlpha: 0 });

  const t0 = performance.now();
  const qp = new URLSearchParams(location.search);
  const FAILSAFE_MS = Math.max(0, Number(qp.get('failsafe')) || 7000); // ?failsafe=1000 to test
  const FIRST_PASS_TIMEOUT_MS = 12000;
  let framesAborted = false;
  let revealStarted = false;
  let released = false;
  const mb = (b) => (b / 1048576).toFixed(1).replace('.', ',');

  // 1st choice: 60fps WebP sequence on <canvas>. The preloader only waits for the keyframe pass.
  async function startFrames() {
    if (typeof createImageBitmap !== 'function' || !canvas || !canvas.getContext) throw new Error('no ImageBitmap/canvas');
    const set = pickFrameSet(isMobile);
    const manifest = await loadManifest(`${set.dir}manifest.json`);
    if (framesAborted) throw new Error('frame pass aborted');
    const st = store = createFrameStore(manifest, set.dir, {
      hiRadius: set.hiRadius,
      onFrame: (i) => renderer && renderer.invalidate(i),
    });
    await st.loadCoarse((ratio, bytes, done, total) => {
      realLoad = ratio;
      plBytes.textContent = `${mb(bytes)} MB · ${done}/${total} CHAVE`;
    });
    if (framesAborted) { store = null; throw new Error('frame pass aborted'); }
    renderer = createCanvasRenderer(canvas, store, { fps: store.fps });
    scrub.use(renderer);
    store.startBackground();
    footage = 'frames';
    body.classList.add('has-frames');
    plStatus.textContent = `SINAL TRAVADO · ${store.count} QUADROS @ ${store.fps}`;
  }

  // Fallback: the legacy all-intra MP4, seeked.
  async function startVideo() {
    realLoad = 0;
    const src = isMobile ? video.dataset.srcMobile : video.dataset.srcDesktop;
    const method = await loadFootage(video, src, (ratio, loaded, total) => {
      if (ratio != null) realLoad = Math.min(1, ratio) * 0.96; // last 4% = decode
      if (total) plBytes.textContent = `${mb(loaded)} / ${mb(total)} MB`;
      else if (loaded) plBytes.textContent = `${mb(loaded)} MB`;
    });
    await primeVideo(video);
    scrub.use(createVideoRenderer(video, { fps: VIDEO_FPS, duration: video.duration || 8 }));
    footage = 'video';
    body.classList.add('has-video');
    plStatus.textContent = method === 'blob' ? 'SINAL TRAVADO · MP4' : 'SINAL TRAVADO · STREAM';
  }

  // First pass (keyframes) must finish within FIRST_PASS_TIMEOUT_MS, otherwise use the fallback chain.
  const firstPass = Promise.race([
    startFrames(),
    new Promise((_, reject) => setTimeout(() => {
      framesAborted = true;
      reject(new Error('keyframe pass timeout'));
    }, FIRST_PASS_TIMEOUT_MS)),
  ]);

  firstPass
    .catch((err) => {
      console.warn('[expedition] frame sequence unavailable, video fallback:', err && err.message);
      return startVideo();
    })
    .catch((err) => {
      console.warn('[expedition] footage unavailable, still-frame mode:', err && err.message);
      if (footage === 'frames' || footage === 'video') return;
      footage = 'stills';
      body.classList.add('no-video');
      stills.forEach((img) => { img.src = img.dataset.src; });
      plStatus.textContent = 'MODO QUADRO ESTÁTICO';
    })
    .finally(() => {
      realLoad = 1;
      // frames are ready: release the scene right away (short beat so the counter shows 100)
      const wait = Math.max(0, (reduced ? 200 : 700) - (performance.now() - t0));
      setTimeout(reveal, wait);
    });

  // Idempotent release: works even if gsap/requestAnimationFrame never tick (hidden tab, throttled).
  let revealTl = null;
  function release() {
    if (released) return;
    released = true;
    preloading = false;
    try { if (revealTl) revealTl.kill(); } catch (_) { /* noop */ }
    try {
      plPct.textContent = '100';
      gsap.set(heroLines, { yPercent: 0 });
      gsap.set(heroMeta, { autoAlpha: 1 });
      gsap.set(media, { scale: 1.12 });
    } catch (_) { /* noop */ }
    preloader.style.pointerEvents = 'none';
    preloader.style.visibility = 'hidden';
    preloader.remove();
    body.classList.remove('is-loading');
    try { if (lenis) lenis.start(); } catch (_) { /* noop */ }
    try { buildStory(); } catch (err) { console.warn('[expedition] story build failed:', err && err.message); }
  }

  function forceRelease() { if (!released) { console.warn('[expedition] fail-safe release'); release(); } }

  function reveal() {
    if (revealStarted || released) return;
    revealStarted = true;
    preloading = false;
    plPct.textContent = '100';
    plRing.style.strokeDashoffset = '0';
    plSr.textContent = 'Imagens carregadas';
    window.scrollTo(0, 0);
    // if the animation cannot progress (rAF paused), release anyway shortly after
    setTimeout(forceRelease, 4500);

    const done = () => release();

    if (reduced) {
      gsap.set(heroLines, { yPercent: 0 });
      gsap.set(heroMeta, { autoAlpha: 1 });
      revealTl = gsap.to(preloader, { autoAlpha: 0, duration: 0.3, onComplete: done });
      return;
    }

    revealTl = gsap.timeline({ onComplete: done })
      .to('.radar', { scale: 2.4, autoAlpha: 0, duration: 1.1, ease: 'expo.in' })
      .to('.preloader__meta, .preloader__pct', { autoAlpha: 0, y: 12, duration: 0.5, ease: 'power2.in' }, 0.2)
      .to(preloader, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' }, 0.85)
      .fromTo(media, { scale: 1.32 }, { scale: 1.12, duration: 2.4, ease: 'expo.out' }, 0.85)
      .to(heroLines, { yPercent: 0, duration: 1.5, stagger: 0.1, ease: 'expo.out' }, 1.1)
      .to(heroMeta, { autoAlpha: 1, duration: 1.1, stagger: 0.12, ease: 'power2.out' }, 1.5);
  }

  // Fail-safe: never stay stuck on the preloader.
  setTimeout(forceRelease, FAILSAFE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || released) return;
    if (revealStarted || performance.now() - t0 >= FAILSAFE_MS) forceRelease();
  });

  // debugging/verification handle
  window.__expedition = {
    scrub, video, canvas,
    get lenis() { return lenis; },
    get footage() { return footage; },
    get store() { return store; },
    get renderer() { return renderer; },
  };
}
