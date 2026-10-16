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
 * Memory strategy (476 frames; fully decoded 1600x900 would be ~2.7 GB):
 *  - every encoded WebP is kept as a Blob (~46 MB desktop / ~15 MB mobile set);
 *  - "keyframes" (1 in 8, + the last) are decoded once at <=640px wide and kept for the
 *    session (~61 x 0.9 MB ~ 56 MB): they are the instant fallback anywhere on the timeline;
 *  - full-resolution bitmaps are kept only in a window around the scroll position
 *    (desktop +-18 frames ~ 37 x 5.8 MB ~ 210 MB; mobile/low-memory set +-24 frames at
 *    800x450 ~ 49 x 1.4 MB ~ 70 MB). Frames leaving the window (+6 hysteresis) are
 *    bitmap.close()d and re-decoded from their Blob on demand.
 *  - narrow screens (<=820px) or navigator.deviceMemory <= 4 use the 800x450 set.
 * ===================================================================== */

export function pickFrameSet(isMobile) {
  const mem = navigator.deviceMemory;
  const lowMem = typeof mem === 'number' && mem <= 4;
  return isMobile || lowMem
    ? { dir: 'assets/frames-m/', hiRadius: 24, tier: isMobile ? 'mobile' : 'low-memory' }
    : { dir: 'assets/frames/', hiRadius: 18, tier: 'desktop' };
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
  hiRadius = 18,
  fetchConcurrency = 6,
  decodeConcurrency = 3,
  onFrame = null,
} = {}) {
  const n = manifest.count;
  const { width, height } = manifest;
  const url = (i) => base + manifest.pattern.replace(/%0?(\d*)d/, (_, w) => String(i + 1).padStart(Number(w) || 0, '0'));
  const lowOpts = width > lowWidth
    ? { resizeWidth: lowWidth, resizeHeight: Math.round((lowWidth * height) / width), resizeQuality: 'medium' }
    : null;
  const evictAt = hiRadius + 6;

  const blobs = new Array(n);
  const fetchState = new Uint8Array(n); // 0 idle, 1 in flight, 2 done, 3 failed
  const decState = new Uint8Array(n);   // 0 idle, 1 decoding, 2 failed
  const lo = new Array(n);
  const hi = new Array(n);
  let hiCount = 0;
  let bytes = 0;
  let fetched = 0;
  let inflight = 0;
  let decInflight = 0;
  let background = false;
  let focus = 0;
  let lastC = -1;

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

  async function decodeHi(i) {
    decState[i] = 1;
    decInflight++;
    try {
      const bmp = await decode(blobs[i]);
      if (hi[i] || Math.abs(i - focus) > evictAt) bmp.close(); // scrolled away meanwhile
      else { hi[i] = bmp; hiCount++; if (onFrame) onFrame(i); }
      decState[i] = 0;
    } catch (_) {
      decState[i] = 2;
    } finally {
      decInflight--;
      pump();
    }
  }

  function evict() {
    for (let i = 0; i < n; i++) {
      if (hi[i] && Math.abs(i - focus) > evictAt) { hi[i].close(); hi[i] = null; hiCount--; }
    }
  }

  /** nearest index to c (searching outward up to maxD) that satisfies pred */
  function nearest(c, maxD, pred) {
    for (let d = 0; d <= maxD; d++) {
      if (c - d >= 0 && pred(c - d)) return c - d;
      if (d && c + d < n && pred(c + d)) return c + d;
    }
    return -1;
  }

  function pump() {
    if (!background) return; // during the keyframe pass nothing else competes for the network
    const c = Math.round(focus);
    // 1) background download: nearest missing frame first
    while (inflight < fetchConcurrency) {
      const i = nearest(c, n, (k) => fetchState[k] === 0);
      if (i < 0) break;
      fetchOne(i);
    }
    // 2) full-res decode window around the playhead
    while (decInflight < decodeConcurrency) {
      const i = nearest(c, hiRadius, (k) => blobs[k] && !hi[k] && decState[k] === 0);
      if (i < 0) break;
      decodeHi(i);
    }
  }

  return {
    count: n,
    width,
    height,
    fps: manifest.fps || 60,

    /** Pass 1: keyframes only. Resolves once the timeline is fully covered (low-res). */
    async loadCoarse(onProgress) {
      const queue = anchors.slice();
      let done = 0;
      const worker = async () => {
        while (queue.length) {
          const i = queue.shift();
          await fetchOne(i);
          if (blobs[i]) {
            try { lo[i] = await decode(blobs[i], lowOpts); } catch (_) { /* counted below */ }
          }
          done++;
          if (onProgress) onProgress(done / anchors.length, bytes, done, anchors.length);
        }
      };
      await Promise.all(Array.from({ length: fetchConcurrency }, worker));
      const ok = anchors.filter((i) => lo[i]).length;
      if (!lo[0] || ok < anchors.length * 0.9) throw new Error(`keyframes failed (${ok}/${anchors.length})`);
      await decodeHi(0); // opening shot sharp from the first paint
    },

    /** Pass 2: fill the remaining frames in the background, nearest to the playhead first. */
    startBackground() { background = true; pump(); },

    /** current fractional frame position (drives priorities and the decode window) */
    setFocus(pos) {
      focus = pos;
      const c = Math.round(pos);
      if (c !== lastC) { lastC = c; evict(); pump(); }
    },

    /** best bitmap available for frame i: full-res, else a full-res neighbour (+-3), else nearest keyframe */
    get(i) {
      if (hi[i]) return hi[i];
      const h = nearest(i, 3, (k) => hi[k]);
      if (h >= 0) return hi[h];
      const l = nearest(i, n, (k) => lo[k]);
      return l >= 0 ? lo[l] : null;
    },

    get stats() {
      return {
        fetched, total: n, mb: +(bytes / 1048576).toFixed(1), hi: hiCount,
        lo: anchors.filter((i) => lo[i]).length, inflight, decoding: decInflight,
        decodedMB: Math.round((hiCount * width * height * 4 + anchors.length * (lowOpts ? lowOpts.resizeWidth * lowOpts.resizeHeight : width * height) * 4) / 1048576),
      };
    },
    /** debug: is frame i resident at full resolution? */
    hasHi(i) { return !!hi[i]; },
  };
}
