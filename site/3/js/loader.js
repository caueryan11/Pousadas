/**
 * Footage loading.
 * Primary: 60fps WebP image sequence (createFrameStore, bottom of this file).
 * Fallback: the legacy all-intra MP4, loaded with real byte progress (below).
 * Preferred path: fetch the whole file as a stream, report bytes, hand the <video> a blob: URL
 * (seeking a blob is instant and does not depend on HTTP range requests).
 * Fallback path: plain src attribute + buffered ranges as progress.
 */

export async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;

  if (!res.body || typeof res.body.getReader !== 'function') {
    const blob = await res.blob();
    onProgress(blob.size, blob.size);
    return blob;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }
  return new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' });
}

export function waitForMedia(video, timeout = 12000) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) { resolve(); return; }
    const done = (fn, arg) => () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', ok);
      video.removeEventListener('error', bad);
      fn(arg);
    };
    const ok = done(resolve);
    const bad = done(reject, video.error || new Error('media error'));
    const timer = setTimeout(done(reject, new Error('media timeout')), timeout);
    video.addEventListener('loadeddata', ok);
    video.addEventListener('error', bad);
  });
}

/**
 * Attach footage to the video element. Resolves with the method used.
 * @param {HTMLVideoElement} video
 * @param {string} url
 * @param {(ratio:number|null, loaded:number, total:number)=>void} onProgress
 */
export async function loadFootage(video, url, onProgress) {
  try {
    const blob = await fetchWithProgress(url, (loaded, total) => {
      onProgress(total ? loaded / total : null, loaded, total);
    });
    video.src = URL.createObjectURL(blob);
    video.load();
    await waitForMedia(video);
    return 'blob';
  } catch (err) {
    console.warn('[expedition] streamed fetch failed, falling back to direct src:', err && err.message);
  }

  // Fallback: direct src (needs a server with range support for reliable seeking)
  const onBuffer = () => {
    if (!video.duration || !video.buffered.length) return;
    onProgress(video.buffered.end(video.buffered.length - 1) / video.duration, 0, 0);
  };
  video.addEventListener('progress', onBuffer);
  video.src = url;
  video.load();
  try {
    await waitForMedia(video);
    return 'direct';
  } finally {
    video.removeEventListener('progress', onBuffer);
  }
}

/** iOS/Safari only paint seeks after the element has played once. Muted play is allowed. */
export async function primeVideo(video) {
  try {
    await video.play();
  } catch (_) { /* autoplay refused: seeking still works on most engines */ }
  video.pause();
  video.currentTime = 0.02;
}

/* =====================================================================
 * Image-sequence footage (60fps WebP frames) for the canvas renderer.
 *
 * Memory strategy (476 frames; fully decoding the whole 1280x720 set would be ~1.7 GB):
 *  - every encoded WebP is kept as a Blob (~29 MB desktop / ~15 MB mobile set);
 *  - "keyframes" (1 in 8, + the last) are decoded once at <=640px wide and kept for the
 *    session (~61 x 0.9 MB ~ 56 MB): the instant fallback anywhere on the timeline;
 *  - full-resolution bitmaps live in a budget (desktop 72 x 3.5 MB ~ 250 MB; mobile /
 *    low-memory set 80 x 1.4 MB ~ 115 MB) filled *predictively*: the frames the playhead is
 *    about to show, in the direction of travel, spaced by how many frames one display tick
 *    skips at the current speed. Over budget, the frame farthest behind the playhead is
 *    bitmap.close()d (it can be re-decoded from its Blob).
 *  - narrow screens (<=820px) or navigator.deviceMemory <= 4 use the 800x450 set.
 * ===================================================================== */

export function pickFrameSet(isMobile) {
  const mem = navigator.deviceMemory;
  const lowMem = typeof mem === 'number' && mem <= 4;
  return isMobile || lowMem
    ? { dir: 'assets/frames-m/', hiBudget: 80, tier: isMobile ? 'mobile' : 'low-memory' }
    : { dir: 'assets/frames/', hiBudget: 72, tier: 'desktop' };
}

export async function loadManifest(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const m = await res.json();
  if (!(m.count > 1) || !m.width || !m.height || !m.pattern) throw new Error('bad frame manifest');
  return m;
}

/** createImageBitmap with resize options, retrying without them on engines that reject them */
async function decode(blob, opts) {
  if (opts) {
    try { return await createImageBitmap(blob, opts); } catch (_) { /* fall through */ }
  }
  return createImageBitmap(blob);
}

/**
 * @param {{count:number,width:number,height:number,pattern:string,fps?:number}} manifest
 * @param {string} base folder URL ending in '/'
 */
export function createFrameStore(manifest, base, {
  coarseStep = 8,
  lowWidth = 640,
  hiBudget = 72,
  fetchConcurrency = 6,
  decodeConcurrency = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 2)),
  onFrame = null,
} = {}) {
  const n = manifest.count;
  const { width, height } = manifest;
  const url = (i) => base + manifest.pattern.replace(/%0?(\d*)d/, (_, w) => String(i + 1).padStart(Number(w) || 0, '0'));
  const lowOpts = width > lowWidth
    ? { resizeWidth: lowWidth, resizeHeight: Math.round((lowWidth * height) / width), resizeQuality: 'medium' }
    : null;
  const clampI = (i) => (i < 0 ? 0 : i > n - 1 ? n - 1 : i);

  const blobs = new Array(n);
  const fetchState = new Uint8Array(n); // 0 idle, 1 in flight, 2 done, 3 failed
  const decState = new Uint8Array(n);   // 0 idle, 1 decoding, 2 failed
  const lo = new Array(n);
  const hi = new Array(n);
  const wanted = new Uint8Array(n);     // 1 = in the current decode plan
  let plan = [];
  let planKey = '';
  let hiCount = 0;
  let bytes = 0;
  let fetched = 0;
  let inflight = 0;
  let decInflight = 0;
  let decodes = 0;
  let evictions = 0;
  let background = false;
  let focus = 0;
  let vel = 0;     // playhead speed, frames per second (smoothed)
  let dir = 1;     // last direction of travel
  let lastT = 0;
  let lastPos = 0;

  const anchors = [];
  for (let i = 0; i < n; i += coarseStep) anchors.push(i);
  if (anchors[anchors.length - 1] !== n - 1) anchors.push(n - 1);

  async function fetchOne(i) {
    fetchState[i] = 1;
    inflight++;
    try {
      const res = await fetch(url(i));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      blobs[i] = blob;
      bytes += blob.size;
      fetched++;
      fetchState[i] = 2;
    } catch (_) {
      fetchState[i] = 3;
    } finally {
      inflight--;
      pump();
    }
  }

  /** over budget: close the resident frame least likely to be shown next (farthest behind first) */
  function evict() {
    while (hiCount > hiBudget) {
      let worst = -1;
      let worstCost = -1;
      for (let i = 0; i < n; i++) {
        if (!hi[i] || wanted[i]) continue;
        const d = (i - focus) * dir;
        const cost = d >= 0 ? d : -d * 3;
        if (cost > worstCost) { worstCost = cost; worst = i; }
      }
      if (worst < 0) return; // everything resident is wanted: let the budget stretch a little
      hi[worst].close();
      hi[worst] = null;
      hiCount--;
      evictions++;
    }
  }

  async function decodeHi(i) {
    decState[i] = 1;
    decInflight++;
    try {
      const bmp = await decode(blobs[i]);
      decodes++;
      if (hi[i]) bmp.close();
      else { hi[i] = bmp; hiCount++; evict(); if (hi[i] && onFrame) onFrame(i); }
      decState[i] = 0;
    } catch (_) {
      decState[i] = 2;
    } finally {
      decInflight--;
      pump();
    }
  }

  /**
   * Decode plan: the frames the playhead is about to show, in order.
   * floor/ceil of the playhead first, then the path ahead in the direction of travel, spaced by
   * the number of frames one 60Hz tick skips at the current speed (decoding frames that will be
   * jumped over is wasted work), with a few frames behind interleaved for small reversals.
   */
  function replan() {
    const a = clampI(Math.floor(focus));
    const speed = Math.abs(vel);
    const stride = speed > 260 ? 4 : speed > 170 ? 3 : speed > 85 ? 2 : 1;
    const key = `${a}|${stride}|${dir}`;
    if (key === planKey) return;
    planKey = key;
    for (let k = 0; k < plan.length; k++) wanted[plan[k]] = 0;
    plan = [];
    const cap = Math.max(8, hiBudget - 8);
    const add = (i) => { if (i >= 0 && i < n && !wanted[i] && plan.length < cap) { wanted[i] = 1; plan.push(i); } };
    // Slow: the frames on screen come first. Fast: those are gone before a decode (~30-60 ms)
    // could finish, so start where the playhead will be by then.
    const lead = stride > 1 ? Math.round(speed * 0.05) : 0;
    if (!lead) { add(a); add(a + 1); }
    const start = (dir > 0 ? a + 1 : a) + dir * lead;
    let behind = 1;
    for (let d = stride, k = 0; plan.length < cap; d += stride, k++) {
      const i = start + dir * d;
      const out = i < 0 || i >= n;
      if (!out) add(i);
      if (k % 3 === 2 && behind <= 10) { add(dir > 0 ? a - behind : a + 1 + behind); behind++; }
      if (out && (behind > 10 || d > n)) break;
    }
  }

  function pump() {
    if (!background) return; // during the keyframe pass nothing else competes for the network
    // 1) decode the plan, in order
    for (let k = 0; k < plan.length && decInflight < decodeConcurrency; k++) {
      const i = plan[k];
      if (blobs[i] && !hi[i] && decState[i] === 0) decodeHi(i);
    }
    // 2) download: planned frames first, then the nearest missing frame (ahead of the playhead first)
    for (let k = 0; k < plan.length && inflight < fetchConcurrency; k++) {
      const i = plan[k];
      if (fetchState[i] === 0) fetchOne(i);
    }
    const c = clampI(Math.round(focus));
    while (inflight < fetchConcurrency) {
      let i = -1;
      for (let d = 0; d <= n && i < 0; d++) {
        const f = c + dir * d;
        const b = c - dir * d;
        if (f >= 0 && f < n && fetchState[f] === 0) i = f;
        else if (d && b >= 0 && b < n && fetchState[b] === 0) i = b;
        if (f < 0 && b < 0) break;
        if (f >= n && b >= n) break;
      }
      if (i < 0) break;
      fetchOne(i);
    }
  }

  /** nearest index at or beyond `from`, stepping by `step`, within maxD, that has a bitmap in `arr` */
  function scan(arr, from, step, maxD) {
    for (let d = 0, i = from; d <= maxD && i >= 0 && i < n; d++, i += step) if (arr[i]) return i;
    return -1;
  }

  return {
    count: n,
    width,
    height,
    fps: manifest.fps || 60,

    /** Pass 1: keyframes only. Resolves once the timeline is fully covered (low-res). */
    async loadCoarse(onProgress) {
      const queue = anchors.slice();
      const decodes = [];
      let done = 0;
      // downloads never wait for decodes: each worker hands its blob to the decoder and fetches on
      const lowDecode = async (i) => {
        if (blobs[i]) {
          try { lo[i] = await decode(blobs[i], lowOpts); } catch (_) { /* counted below */ }
        }
        done++;
        if (onProgress) onProgress(done / anchors.length, bytes, done, anchors.length);
      };
      const worker = async () => {
        while (queue.length) {
          const i = queue.shift();
          await fetchOne(i);
          decodes.push(lowDecode(i));
        }
      };
      await Promise.all(Array.from({ length: fetchConcurrency }, worker));
      await Promise.all(decodes);
      const ok = anchors.filter((i) => lo[i]).length;
      if (!lo[0] || ok < anchors.length * 0.9) throw new Error(`keyframes failed (${ok}/${anchors.length})`);
      await decodeHi(0); // opening shot sharp from the first paint
    },

    /** Pass 2: fill the remaining frames in the background, along the predicted path first. */
    startBackground() { background = true; replan(); pump(); },

    /** current fractional frame position (drives the speed estimate, the plan and priorities) */
    setFocus(pos) {
      const now = performance.now();
      const dt = lastT ? (now - lastT) / 1000 : 0;
      lastT = now;
      if (dt > 0.2) vel = 0;
      else if (dt > 0.001) vel += ((pos - lastPos) / dt - vel) * Math.min(1, dt * 12);
      lastPos = pos;
      focus = pos;
      if (Math.abs(vel) > 3 && Math.sign(vel) !== dir) dir = Math.sign(vel);
      const before = planKey;
      replan();
      if (planKey !== before) { evict(); pump(); }
    },

    /**
     * What to draw for fractional position pos: { A, B, t } meaning "draw A, then B on top at
     * alpha t". Uses the two nearest frames around pos that are resident (full-res if one is at
     * least as close as the nearest keyframe, else the low-res keyframe), so the picture keeps
     * moving continuously even while frames are still decoding: no step back to a keyframe.
     */
    pair(pos) {
      const a = clampI(Math.floor(pos));
      const f = pos - a;
      const b = f > 0.002 ? clampI(a + 1) : a;
      const li = scan(hi, a, -1, coarseStep);
      const ui = scan(hi, b, 1, coarseStep);
      const la = scan(lo, a, -1, n);
      const ua = scan(lo, b, 1, n);
      let lower = -1; let lowerBmp = null;
      if (li >= 0 && (la < 0 || li >= la)) { lower = li; lowerBmp = hi[li]; } else if (la >= 0) { lower = la; lowerBmp = lo[la]; }
      let upper = -1; let upperBmp = null;
      if (ui >= 0 && (ua < 0 || ui <= ua)) { upper = ui; upperBmp = hi[ui]; } else if (ua >= 0) { upper = ua; upperBmp = lo[ua]; }
      if (!lowerBmp && !upperBmp) return null;
      if (!lowerBmp) return { A: upperBmp, B: null, t: 0 };
      if (!upperBmp || upper === lower) return { A: lowerBmp, B: null, t: 0 };
      return { A: lowerBmp, B: upperBmp, t: (pos - lower) / (upper - lower) };
    },

    /** best single bitmap for frame i (kept for compatibility) */
    get(i) {
      const p = this.pair(i);
      return p ? p.A : null;
    },

    get stats() {
      return {
        fetched, total: n, mb: +(bytes / 1048576).toFixed(1), hi: hiCount,
        lo: anchors.filter((i) => lo[i]).length, inflight, decoding: decInflight,
        decodes, evictions, vel: Math.round(vel), plan: plan.length,
        decodedMB: Math.round((hiCount * width * height * 4 + anchors.length * (lowOpts ? lowOpts.resizeWidth * lowOpts.resizeHeight : width * height) * 4) / 1048576),
      };
    },
    /** debug: is frame i resident at full resolution? */
    hasHi(i) { return !!hi[i]; },
  };
}
