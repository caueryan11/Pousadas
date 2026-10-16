/**
 * scrub-video.js — turns a 0..1 scroll progress into video frames.
 *
 * Two render modes:
 *
 *  'canvas' (default in scrub mode — the smooth one)
 *    The <video> is only used as a DECODER. Each needed frame is seeked once,
 *    copied into a small pool of offscreen canvases, and a visible <canvas>
 *    shows frame i blended with frame i+1 by the fractional position
 *    (i + 0.37 → 63 % of i, 37 % of i+1). The footage is 24 fps, so without
 *    blending the picture can only change in 192 hard steps across the whole
 *    pinned scroll (one step every ~25 px on desktop) and on a 60 Hz screen
 *    about half the display frames repeated the previous image. With blending
 *    every display frame gets its own image, there is never more than one seek
 *    in flight, and the next seek is chained straight from `seeked`.
 *    No extra download: it decodes the same scene-scrub*.mp4 files.
 *
 *  'video' (fallback: no canvas 2D, or `?video` in the URL)
 *    The classic approach: ease a `current` time toward the target and set
 *    video.currentTime, one seek at a time.
 *
 * TROCAR O VÍDEO (swap the footage): edit the <source> tags and the
 * data-portrait-src / data-fps attributes on the <video> in index.html.
 * Encode with a keyframe on EVERY frame (-g 1) — see the ffmpeg commands
 * there. data-fps must match the file's frame rate (ffprobe … r_frame_rate).
 *
 * The file is fetched once as a Blob so every seek is served from memory
 * instead of HTTP range requests (skipped when opened via file://).
 */
export class ScrubVideo {
  /**
   * @param {HTMLVideoElement} video
   * @param {{ mode?: 'canvas'|'video', ease?: number, prime?: boolean,
   *           onReady?: (v: ScrubVideo) => void, onFail?: (err: unknown) => void }} opts
   */
  constructor(video, opts = {}) {
    this.video = video;
    this.mode = opts.mode ?? 'video';
    this.ease = opts.ease ?? 0.2;            // video mode only, per 60 Hz frame
    this.fps = parseFloat(video.dataset.fps) || 24;
    this.onReady = opts.onReady ?? (() => {});
    this.onFail = opts.onFail ?? (() => {});
    this.duration = 0;
    this.progress = 0;
    this.target = 0;
    this.current = 0;
    this.seeking = false;
    this.seekTimer = 0;
    this.ready = false;
    this.failed = false;
    this.draws = 0;
    this.shownTime = null;                   // what is actually on screen (seconds)
    this._tick = this._tick.bind(this);

    if (this.mode === 'canvas' && !this._setupCanvas()) this.mode = 'video';
    this.surface = this.mode === 'canvas' ? this.canvas : video;

    this._bindErrors();
    this._waitForMetadata();
    this._loadAsBlob();
    if (opts.prime !== false) this._primeOnFirstTouch();

    if (this.mode === 'canvas') {
      this._attachDecoder(video);
    } else {
      video.addEventListener('seeked', () => {
        clearTimeout(this.seekTimer);
        this.seeking = false;
      });
      // A src swap (blob) aborts any seek in flight; `seeked` will never come.
      video.addEventListener('emptied', () => {
        clearTimeout(this.seekTimer);
        this.seeking = false;
      });
    }
  }

  /** progress 0..1 coming from ScrollTrigger */
  setProgress(p) {
    this.progress = Math.min(1, Math.max(0, p));
    // stop a hair before the end: seeking to exactly `duration` can show a black frame
    this.target = this.progress * Math.max(0, this.duration - 0.05);
  }

  /** seconds currently on screen (HUD) */
  get time() { return this.shownTime ?? this.current; }

  start() { window.gsap?.ticker.add(this._tick); }
  stop() { window.gsap?.ticker.remove(this._tick); }

  _tick(_t, deltaMs = 16.7) {
    if (!this.ready || this.failed) return;
    if (this.mode === 'canvas') {
      this.frameF = this.progress * (this.frameCount - 1);
      this._pump();
      this._render();
      return;
    }

    // ---- video mode: frame-rate independent damping toward the target ----
    const k = 1 - Math.pow(1 - this.ease, deltaMs / 16.667);
    const delta = this.target - this.current;
    this.current = Math.abs(delta) < 0.002 ? this.target : this.current + delta * k;

    const v = this.video;
    if (this.seeking) return;
    if (Math.abs(v.currentTime - this.current) < 0.5 / this.fps) return; // already on that frame
    this.seeking = true;
    v.currentTime = this.current;
    // Safety net: some browsers skip `seeked` when the frame doesn't change.
    clearTimeout(this.seekTimer);
    this.seekTimer = setTimeout(() => { this.seeking = false; }, 700);
  }

  /* ======================= canvas mode ======================= */

  _setupCanvas() {
    const c = document.createElement('canvas');
    const ctx = c.getContext && c.getContext('2d', { alpha: false });
    if (!ctx) return false;
    c.className = 'media__canvas';
    c.setAttribute('aria-hidden', 'true');
    this.video.after(c);
    this.canvas = c;
    this.ctx = ctx;
    this.pool = new Map();       // frame index -> offscreen canvas holding that decoded frame
    this.spare = [];             // evicted canvases, reused
    this.poolSize = 10;          // ~3.7 MB each at 1280×720, ~1.2 MB at 404×720
    this.decoders = [];          // <video> elements used to decode; each has ≤ 1 seek in flight
    this.frameF = 0;
    this.lastFrameF = 0;
    this.dir = 1;
    this.frameCount = 1;
    this.decodable = false;
    this._key = '';
    this._fit = null;

    new ResizeObserver(() => { this._fit = null; this._key = ''; this._render(); }).observe(c);

    const v = this.video;
    const markDecodable = () => {
      // With http(s) wait for the in-memory blob; range-less servers can't seek a stream.
      if (this.blobPending) return;
      if (v.readyState >= 1) { this.decodable = true; this._pump(); }
    };
    this._markDecodable = markDecodable;
    v.addEventListener('loadeddata', markDecodable);
    v.addEventListener('loadedmetadata', markDecodable);
    return true;
  }

  /** Register a <video> as a frame decoder. */
  _attachDecoder(el) {
    const dec = { el, pending: -1, timer: 0 };
    el.addEventListener('seeked', () => this._onFrameDecoded(dec));
    // A src swap (blob) aborts any seek in flight; `seeked` will never come.
    el.addEventListener('emptied', () => { clearTimeout(dec.timer); dec.pending = -1; });
    this.decoders.push(dec);
    return dec;
  }

  /**
   * A second decoder doubles throughput: while scrolling, one <video> only
   * delivered ~55 seeks/s (≈ 1 per display frame), just under what a brisk
   * scroll needs, so the decoder was never more than ~1 frame ahead.
   * Same blob URL → no extra download.
   */
  _addSecondDecoder(url) {
    if (this.mode !== 'canvas' || this.decoders.length > 1) return;
    const el = document.createElement('video');
    el.className = 'media__video media__video--decoder';
    el.muted = true; el.playsInline = true; el.preload = 'auto';
    el.setAttribute('muted', ''); el.setAttribute('playsinline', ''); el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    el.disablePictureInPicture = true;
    el.src = url;
    this.video.after(el);
    const dec = this._attachDecoder(el);
    dec.idleUntilLoaded = true;
    el.addEventListener('loadeddata', () => { dec.idleUntilLoaded = false; this._pump(); }, { once: true });
  }

  /** Hand the most urgent missing frames to idle decoders. */
  _pump() {
    if (!this.decodable || this.failed) return;
    const last = this.frameCount - 1;
    const f = this.frameF;
    if (f !== this.lastFrameF) this.dir = f > this.lastFrameF ? 1 : -1;
    this.lastFrameF = f;
    const d = this.dir;
    const i = Math.min(last, Math.max(0, Math.floor(f)));
    const want = [i, i + 1, i + 2 * d, i + 3 * d, i - d, i + 4 * d, i + 5 * d];
    const busy = new Set(this.decoders.map((x) => x.pending));

    for (const dec of this.decoders) {
      if (dec.pending >= 0 || dec.idleUntilLoaded || dec.el.readyState < 1) continue;
      const next = want.find((k) => k >= 0 && k <= last && !this.pool.has(k) && !busy.has(k));
      if (next === undefined) return;
      busy.add(next);
      dec.pending = next;
      dec.el.currentTime = (next + 0.5) / this.fps;   // middle of the frame: no rounding to the neighbour
      clearTimeout(dec.timer);
      dec.timer = setTimeout(() => { dec.pending = -1; this._pump(); }, 700);
    }
  }

  _onFrameDecoded(dec) {
    clearTimeout(dec.timer);
    const k = dec.pending;
    dec.pending = -1;
    const v = dec.el;
    if (k < 0 || !v.videoWidth) { this._pump(); return; }

    let slot = this.pool.get(k);
    if (!slot) {
      if (this.pool.size >= this.poolSize) {
        // evict the frame farthest from where we are now
        let far = -1; let farD = -1;
        for (const key of this.pool.keys()) {
          const dist = Math.abs(key - this.frameF);
          if (dist > farD) { farD = dist; far = key; }
        }
        this.spare.push(this.pool.get(far));
        this.pool.delete(far);
      }
      slot = this.spare.pop() || document.createElement('canvas');
      if (slot.width !== v.videoWidth || slot.height !== v.videoHeight) {
        slot.width = v.videoWidth; slot.height = v.videoHeight;
        this._fit = null;
      }
      this.pool.set(k, slot);
    }
    slot.getContext('2d', { alpha: false }).drawImage(v, 0, 0, slot.width, slot.height);
    // repaint only if this frame is (or could stand in for) what's on screen
    const i = Math.floor(this.frameF);
    if (k === i || k === i + 1 || !this.pool.has(i)) { this._key = ''; this._render(); }
    this._pump();      // chain the next decode immediately, no waiting for the next frame
  }

  /** object-fit: cover, done once per size. Backing store never exceeds the source resolution. */
  _computeFit(sw, sh) {
    const c = this.canvas;
    const cssW = c.clientWidth || 1;
    const cssH = c.clientHeight || 1;
    const cover = Math.max(cssW / sw, cssH / sh);           // css px per source px
    const ratio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1 / cover));
    const w = Math.round(cssW * ratio);
    const h = Math.round(cssH * ratio);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const s = cover * ratio;
    this._fit = { sw, sh, dw: sw * s, dh: sh * s, dx: (w - sw * s) / 2, dy: (h - sh * s) / 2 };
  }

  _render() {
    if (this.mode !== 'canvas' || !this.pool.size) return;
    const f = this.frameF;
    const i = Math.floor(f);
    const a = f - i;
    let base = this.pool.get(i);
    let top = null;
    let shown = i;
    if (base) {
      if (a > 0.002) {
        top = this.pool.get(i + 1) || null;
        if (top) shown = f;
      }
    } else {
      // fast fling: frame not decoded yet — show the closest one we have
      let best = -1; let bestD = Infinity;
      for (const key of this.pool.keys()) {
        const d = Math.abs(key - f);
        if (d < bestD) { bestD = d; best = key; }
      }
      base = this.pool.get(best);
      shown = best;
    }

    const alpha = top ? Math.round(a * 255) / 255 : 0;  // 256 steps is invisible, saves redundant draws
    const key = `${shown === f ? i : shown}|${top ? alpha : 0}`;
    if (key === this._key) return;
    this._key = key;

    if (!this._fit) this._computeFit(base.width, base.height);
    const { dx, dy, dw, dh } = this._fit;
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.drawImage(base, dx, dy, dw, dh);
    if (top) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(top, dx, dy, dw, dh);
    }
    this.draws += 1;
    this.shownTime = (shown / Math.max(1, this.frameCount - 1)) * Math.max(0, this.duration - 0.05);

    if (this.draws === 1) document.documentElement.classList.add('is-canvas');
  }

  /* ======================= shared ======================= */

  _waitForMetadata() {
    const v = this.video;
    const onMeta = () => {
      if (!Number.isFinite(v.duration) || v.duration <= 0) return;
      this.duration = v.duration;
      this.frameCount = Math.max(1, Math.round(v.duration * this.fps));
      this.target = this.progress * Math.max(0, this.duration - 0.05);
      if (!this.ready) {
        this.ready = true;
        v.pause();
        this.onReady(this);
      }
    };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    if (v.readyState >= 1) onMeta();
  }

  _bindErrors() {
    const v = this.video;
    const sources = [...v.querySelectorAll('source')];
    let failedCount = 0;
    const fail = (err) => {
      if (this.failed || this.ready) return;
      this.failed = true;
      this.onFail(err);
    };
    // With <source> children the error fires on each <source>, not on <video>.
    sources.forEach((s) => s.addEventListener('error', () => {
      failedCount += 1;
      if (failedCount >= sources.length) fail(new Error('No playable video source'));
    }));
    v.addEventListener('error', () => fail(v.error));
    // Errors may have fired before this module ran (modules are deferred).
    if (v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) fail(new Error('No playable video source'));
  }

  /**
   * Fetch the right file once and play it from memory.
   * Phones in portrait get data-portrait-src (a 9:16 centre crop, ~2.5× lighter):
   * with object-fit: cover a 16:9 frame would show only that strip anyway.
   */
  async _loadAsBlob() {
    const v = this.video;
    // index.html ships preload="none" so the browser doesn't download the file
    // on its own in parallel. Without a blob, hand loading back to the browser.
    const loadNatively = () => {
      if (v.preload === 'auto') return;
      v.preload = 'auto';
      v.load();
    };
    if (location.protocol === 'file:' || !('fetch' in window)) { loadNatively(); return; }
    const candidates = [];
    const portrait = v.dataset.portraitSrc;
    const portraitMq = v.dataset.portraitMedia || '(max-aspect-ratio: 5/8)';
    if (portrait && window.matchMedia(portraitMq).matches) candidates.push(portrait);
    const source = [...v.querySelectorAll('source')]
      .find((s) => !s.type || v.canPlayType(s.type) !== '');
    if (source) candidates.push(source.src);
    if (!candidates.length) { loadNatively(); return; }

    this.blobPending = true;
    try {
      for (const src of candidates) {
        try {
          const res = await fetch(src, { cache: 'force-cache' });
          if (!res.ok) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const keepTime = this.current;
          this.pool?.clear();          // a different file may have a different size
          this._fit = null;
          v.src = url;                 // `src` attribute wins over <source> children
          v.load();
          if (this.mode !== 'canvas') {
            v.addEventListener('loadedmetadata', () => { v.currentTime = keepTime; }, { once: true });
          }
          this.blobUrl = url;
          this._addSecondDecoder(url);
          return;
        } catch { /* try the next candidate */ }
      }
      loadNatively();   // every fetch failed: let <source> streaming (and its error events) take over
    } finally {
      this.blobPending = false;
      this._markDecodable?.();
    }
  }

  /** iOS Safari won't paint seeked frames until the video was "played" once by a gesture. */
  _primeOnFirstTouch() {
    const prime = () => {
      const p = this.video.play();
      if (p && p.then) p.then(() => this.video.pause()).catch(() => {});
      window.removeEventListener('touchstart', prime);
      window.removeEventListener('pointerdown', prime);
    };
    window.addEventListener('touchstart', prime, { passive: true, once: true });
    window.addEventListener('pointerdown', prime, { passive: true, once: true });
  }
}
