/**
 * Scroll scrubber.
 *
 * createScrubber()        keeps the *rendered* position (0..1) chasing the scroll target with a
 *                         critically damped spring integrated with real dt (frame-rate independent),
 *                         and hands it to a renderer once per tick.
 * createCanvasRenderer()  draws an image sequence into a <canvas>: manual object-fit: cover, capped DPR,
 *                         sub-frame blending (frame floor(p), then frame ceil(p) on top at alpha = frac).
 * createVideoRenderer()   legacy fallback: seeks an all-intra <video>, coalescing seeks.
 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Critically damped spring towards `target` (Game Programming Gems 4 "SmoothDamp" form,
 * stable for any dt, never overshoots).
 */
function smoothDamp(s, target, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = s.x - target;
  const temp = (s.v + omega * change) * dt;
  s.v = (s.v - omega * temp) * exp;
  let next = target + (change + temp) * exp;
  if ((target - s.x > 0) === (next > target)) { next = target; s.v = 0; }
  s.x = next;
}

export function createScrubber({ smoothTime = 0.16, reduced = false } = {}) {
  const s = { x: 0, v: 0 };
  let target = 0;
  let lastNow = 0;
  let renderer = null;

  return {
    setTarget(p) { target = clamp(p, 0, 1); },
    /** attach (or swap) the renderer that turns progress into pixels */
    use(r) { renderer = r; },
    /** @param {number} _dt60 unused (kept for API compat)  @param {number} now ms */
    tick(_dt60, now) {
      const dt = lastNow ? clamp((now - lastNow) / 1000, 0, 0.1) : 1 / 60;
      lastNow = now;
      if (reduced) { s.x = target; s.v = 0; }
      else if (s.x !== target || s.v !== 0) {
        smoothDamp(s, target, smoothTime, dt);
        if (Math.abs(s.x - target) < 1e-6 && Math.abs(s.v) < 1e-5) { s.x = target; s.v = 0; }
      }
      if (renderer) renderer.render(s.x, now);
    },
    get progress() { return s.x; },
    get target() { return target; },
    get frame() { return renderer ? renderer.frame : 0; },
    get frames() { return renderer ? renderer.frames : 1; },
    get fps() { return renderer ? renderer.fps : 24; },
    get duration() { return renderer ? renderer.duration : 8; },
    get enabled() { return !!renderer; },
    get mode() { return renderer ? renderer.mode : 'none'; },
    get stats() { return renderer ? renderer.stats : null; },
  };
}

/* ------------------------------------------------------------------ canvas */

function parseFocus(value) {
  // computed object-position, e.g. "50% 55%"; anything unparsable -> centre
  const parts = String(value || '').trim().split(/\s+/);
  const pct = (t) => (t && t.endsWith('%') ? clamp(parseFloat(t) / 100, 0, 1) : 0.5);
  return [pct(parts[0]), pct(parts[1])];
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {ReturnType<import('./loader.js').createFrameStore>} store
 */
export function createCanvasRenderer(canvas, store, { fps = 60 } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const n = store.count;
  let cw = 0;
  let ch = 0;
  let fx = 0.5;
  let fy = 0.55;
  let lastPos = -1;
  let dirty = true;
  const stats = { draws: 0, blends: 0, last: 0, avg: 0, max: 0, frac: 0, dpr: 1, w: 0, h: 0 };

  function resize() {
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    // DPR capped at 2, and never above what the source can feed: with cover, one CSS px shows
    // 1/scale source px, so a backing store denser than that only costs fill-rate.
    const coverScale = Math.max(cssW / store.width, cssH / store.height);
    const k = Math.min(window.devicePixelRatio || 1, 2, Math.max(1, 1 / coverScale));
    const w = Math.max(1, Math.round(cssW * k));
    const h = Math.max(1, Math.round(cssH * k));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    cw = w; ch = h;
    stats.dpr = k; stats.w = w; stats.h = h;
    [fx, fy] = parseFocus(getComputedStyle(canvas).objectPosition);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    dirty = true;
  }

  function cover(bmp) {
    const iw = bmp.width;
    const ih = bmp.height;
    const sc = Math.max(cw / iw, ch / ih);
    const dw = iw * sc;
    const dh = ih * sc;
    ctx.drawImage(bmp, (cw - dw) * fx, (ch - dh) * fy, dw, dh);
  }

  function draw(pos) {
    const t0 = performance.now();
    // the two nearest resident frames around pos (full-res, or low-res keyframes while decoding)
    const P = store.pair(pos);
    if (!P) return false;
    ctx.globalAlpha = 1;
    cover(P.A);
    if (P.B && P.B !== P.A && P.t > 0.002) {
      ctx.globalAlpha = P.t;
      cover(P.B);
      ctx.globalAlpha = 1;
      stats.blends++;
    }
    const ms = performance.now() - t0;
    stats.draws++;
    stats.last = ms;
    stats.avg = stats.draws === 1 ? ms : stats.avg * 0.95 + ms * 0.05;
    if (ms > stats.max) stats.max = ms;
    stats.frac = P.t;
    return true;
  }

  // Resizing clears the canvas, so redraw in the same callback (runs before paint).
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { resize(); if (lastPos >= 0) draw(lastPos); }) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener('resize', () => { resize(); if (lastPos >= 0) draw(lastPos); });
  resize();

  return {
    mode: 'frames',
    render(p, _now) {
      const pos = clamp(p, 0, 1) * (n - 1);
      store.setFocus(pos);
      if (!dirty && Math.abs(pos - lastPos) < 0.002) return; // nothing visible changed
      if (draw(pos)) { lastPos = pos; dirty = false; }
    },
    /** a better bitmap for frame i just arrived: redraw if it is on screen */
    invalidate(i) { if (lastPos < 0 || Math.abs(i - lastPos) <= 9) dirty = true; },
    get frame() { return lastPos < 0 ? 0 : Math.round(lastPos); },
    frames: n,
    fps,
    duration: n / fps,
    stats,
    destroy() { if (ro) ro.disconnect(); },
  };
}

/* ------------------------------------------------------------------- video */

/**
 * Seeks only when the target frame changes and never while a seek is in flight
 * (after `seeked` the next tick jumps to the latest frame). scrub.mp4 is all-intra.
 */
export function createVideoRenderer(video, { fps = 24, duration = 8 } = {}) {
  const frames = Math.max(1, Math.round(duration * fps));
  let lastFrame = -1;
  let seeking = false;
  let seekStart = 0;
  const stats = { seeks: 0 };
  video.addEventListener('seeked', () => { seeking = false; });

  return {
    mode: 'video',
    render(p, now) {
      if (seeking && now - seekStart > 320) seeking = false; // some engines skip `seeked`
      const frame = Math.round(clamp(p, 0, 1) * (frames - 1));
      if (frame !== lastFrame && !seeking) {
        lastFrame = frame;
        seeking = true;
        seekStart = now;
        stats.seeks++;
        video.currentTime = Math.min(duration - 0.001, (frame + 0.5) / fps);
      }
    },
    invalidate() {},
    get frame() { return lastFrame < 0 ? 0 : lastFrame; },
    frames,
    fps,
    duration,
    stats,
  };
}
