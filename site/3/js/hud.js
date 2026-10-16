/**
 * Simulated telemetry, keyed to what the footage shows:
 *  0.00  drone high over the sea stacks, road below, no vehicle yet
 *  ~0.10 the dark SUV appears on the cliff road  -> target locked
 *  0.25-0.45 drone drops in behind it, ocean on the left
 *  0.55-0.70 tight bend heading into the low sun, sea stacks ahead
 *  0.85-1.00 straight run, cliffs left, open turquoise bay right
 * Every write is skipped when the rendered string is unchanged.
 */

const KEYS = {
  alt: [[0, 140], [0.12, 96], [0.25, 38], [0.4, 9], [0.6, 6], [1, 4.5]],
  spd: [[0, 0], [0.1, 0], [0.14, 58], [0.4, 72], [0.56, 61], [0.72, 70], [1, 94]],
  // heading unwrapped (368 = 8 deg) so interpolation never spins the long way round
  hdg: [[0, 318], [0.25, 334], [0.45, 368], [0.6, 352], [0.72, 296], [0.85, 322], [1, 328]],
  lat: [[0, 38.70412], [1, 38.71966]],
  lon: [[0, -9.48217], [1, -9.47108]],
};

const smooth = (t) => t * t * (3 - 2 * t);

function sample(keys, p) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i];
    if (p <= p1) {
      const [p0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * smooth((p - p0) / (p1 - p0));
    }
  }
  return keys[keys.length - 1][1];
}

const CARDINALS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
const cardinal = (deg) => CARDINALS[Math.round(deg / 45) % 8];
const pad = (n, l = 2) => String(n).padStart(l, '0');

export function createHud(root, { fps = 24 } = {}) {
  const $ = (id) => root.querySelector(`#${id}`);
  const el = {
    tc: $('hud-tc'), hdg: $('hud-hdg'), card: $('hud-card'), rose: $('hud-rose'),
    lat: $('hud-lat'), lon: $('hud-lon'), alt: $('hud-alt'), altBar: $('hud-alt-bar'),
    spd: $('hud-spd'), spdBar: $('hud-spd-bar'), target: $('hud-target'), frame: $('hud-frame'),
  };

  // compass ticks
  const ticks = root.querySelector('.compass__ticks');
  if (ticks) {
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 36; i++) {
      const l = document.createElementNS(ns, 'line');
      const long = i % 9 === 0;
      l.setAttribute('x1', '50'); l.setAttribute('x2', '50');
      l.setAttribute('y1', long ? '5' : '6'); l.setAttribute('y2', long ? '11' : '9');
      l.setAttribute('transform', `rotate(${i * 10} 50 50)`);
      ticks.appendChild(l);
    }
  }

  const cache = new Map();
  const text = (node, value) => {
    if (cache.get(node) === value) return;
    cache.set(node, value);
    node.textContent = value;
  };
  const style = (node, value) => {
    if (cache.get(node) === value) return;
    cache.set(node, value);
    node.style.transform = value;
  };

  let locked = null;

  return {
    /** @param {number} p smoothed footage progress 0..1  @param {number} frame  @param {number} frames  @param {number} duration seconds  @param {number} [fpsNow] footage fps */
    update(p, frame, frames, duration, fpsNow = fps) {
      const alt = sample(KEYS.alt, p);
      const spd = sample(KEYS.spd, p);
      const hdg = ((sample(KEYS.hdg, p) % 360) + 360) % 360;
      const isLocked = p >= 0.1;

      text(el.alt, alt.toFixed(alt < 20 ? 1 : 0).replace('.', ','));
      style(el.altBar, `scaleX(${(alt / 140).toFixed(3)})`);
      text(el.spd, isLocked ? String(Math.round(spd)) : '--');
      style(el.spdBar, `scaleX(${(spd / 120).toFixed(3)})`);

      const h = Math.round(hdg) % 360;
      text(el.hdg, pad(h, 3));
      text(el.card, cardinal(hdg));
      style(el.rose, `rotate(${(-hdg).toFixed(1)}deg)`);

      const lat = sample(KEYS.lat, p);
      const lon = sample(KEYS.lon, p);
      text(el.lat, `${Math.abs(lat).toFixed(5).replace('.', ',')}°${lat >= 0 ? 'N' : 'S'}`);
      text(el.lon, `${Math.abs(lon).toFixed(5).replace('.', ',')}°${lon >= 0 ? 'L' : 'O'}`);

      if (locked !== isLocked) {
        locked = isLocked;
        el.target.textContent = isLocked ? 'TRAVADO · NV-8' : 'ADQUIRINDO';
        el.target.classList.toggle('is-locked', isLocked);
      }

      const t = p * duration;
      const ff = Math.floor((t % 1) * fpsNow);
      text(el.tc, `00:${pad(Math.floor(t))}:${pad(ff)}`);
      text(el.frame, `${pad(frame + 1, 3)} / ${frames}`);
    },
  };
}
