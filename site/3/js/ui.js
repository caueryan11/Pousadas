/* UI pieces: word splitting, magnetic buttons, spec dashboard, locale selector. */

const { gsap } = window;

/** Wrap each word in .w > .w__in so it can slide inside its own mask. */
export function splitWords(el) {
  const label = el.textContent.trim();
  el.setAttribute('aria-label', label);
  el.textContent = '';
  label.split(/\s+/).forEach((word, i, arr) => {
    const w = document.createElement('span');
    w.className = 'w';
    w.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'w__in';
    inner.textContent = word;
    w.appendChild(inner);
    el.appendChild(w);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return el.querySelectorAll('.w__in');
}

/** Magnetic pull for fine pointers only. Rect is read once per hover, never per move. */
export function initMagnetic(nodes) {
  nodes.forEach((el) => {
    const inner = el.querySelector('[data-magnetic-inner]');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3' });
    const ixTo = inner ? gsap.quickTo(inner, 'x', { duration: 0.5, ease: 'power3' }) : null;
    const iyTo = inner ? gsap.quickTo(inner, 'y', { duration: 0.5, ease: 'power3' }) : null;
    let rect = null;
    const strength = el.classList.contains('scroll-cue') ? 0.45 : 0.3;

    el.addEventListener('pointerenter', () => { rect = el.getBoundingClientRect(); });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!rect) rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      xTo(dx * strength); yTo(dy * strength);
      if (ixTo) { ixTo(dx * strength * 0.5); iyTo(dy * strength * 0.5); }
    });
    el.addEventListener('pointerleave', () => {
      rect = null;
      xTo(0); yTo(0);
      if (ixTo) { ixTo(0); iyTo(0); }
    });
  });
}

const fmt = (v, decimals) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function countUp(el, to, decimals, { reduced, duration = 1.6 }) {
  if (reduced) { el.textContent = fmt(to, decimals); return; }
  const o = { v: 0 };
  if (el._countTween) el._countTween.kill();
  el._countTween = gsap.to(o, {
    v: to, duration, ease: 'expo.out',
    onUpdate: () => { el.textContent = fmt(o.v, decimals); },
  });
}

/** Tabs + animated counters + gauge. Returns { start } to fire the first count when visible. */
export function initDashboard(root, { reduced }) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((t) => root.querySelector(`#${t.getAttribute('aria-controls')}`));
  const ink = root.querySelector('.dash__ink');
  const gFill = root.querySelector('#gauge-fill');
  const gVal = root.querySelector('#gauge-val');
  const gCap = root.querySelector('#gauge-cap');
  const gTicks = root.querySelector('.gauge__ticks');
  let index = 0;
  let started = false;
  const gauge = { v: 0 };
  let gaugeTween = null;

  if (gTicks) {
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 60; i++) {
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', '100'); l.setAttribute('x2', '100');
      l.setAttribute('y1', '4'); l.setAttribute('y2', i % 5 === 0 ? '11' : '8');
      l.setAttribute('transform', `rotate(${i * 6} 100 100)`);
      gTicks.appendChild(l);
    }
  }

  const placeInk = (animate) => {
    const t = tabs[index];
    const props = { x: t.offsetLeft, scaleX: t.offsetWidth / 100 };
    if (animate && !reduced) gsap.to(ink, { ...props, duration: 0.6, ease: 'expo.out' });
    else gsap.set(ink, props);
  };

  const runPanel = (panel) => {
    panel.querySelectorAll('[data-count]').forEach((b, i) => {
      countUp(b, parseFloat(b.dataset.count), parseInt(b.dataset.decimals || '0', 10), { reduced, duration: 1.4 + i * 0.12 });
    });
    const g = parseFloat(panel.dataset.gauge);
    gCap.textContent = panel.dataset.gaugeCap;
    countUp(gVal, parseFloat(panel.dataset.gaugeVal), parseInt(panel.dataset.gaugeDecimals || '0', 10), { reduced, duration: 1.8 });
    // tween a proxy: CSSPlugin would round sub-pixel px values (pathLength = 1)
    const paint = () => { gFill.style.strokeDashoffset = String(1 - gauge.v); };
    if (gaugeTween) gaugeTween.kill();
    if (reduced) { gauge.v = g; paint(); }
    else gaugeTween = gsap.fromTo(gauge, { v: 0 }, { v: g, duration: 1.8, ease: 'expo.out', onUpdate: paint });
  };

  const select = (i, focus = false) => {
    if (i === index && started) return;
    const prev = panels[index];
    index = i;
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) tabs[i].focus();
    placeInk(true);
    const next = panels[i];
    if (prev !== next) {
      prev.hidden = true;
      prev.classList.remove('is-active');
    }
    next.hidden = false;
    next.classList.add('is-active');
    if (!reduced) gsap.fromTo(next, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out' });
    started = true;
    runPanel(next);
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      select((map[e.key] + tabs.length) % tabs.length, true);
    });
  });

  placeInk(false);
  window.addEventListener('resize', () => placeInk(false), { passive: true });

  return {
    start() {
      if (started) return;
      started = true;
      runPanel(panels[index]);
    },
  };
}

/** Atelier picker: radio group with live local time. */
export function initLocale(root) {
  const opts = [...root.querySelectorAll('[role="radio"]')];
  const city = root.querySelector('#locale-city');
  const coast = root.querySelector('#locale-coast');
  const time = root.querySelector('#locale-time');
  let current = opts.find((o) => o.getAttribute('aria-checked') === 'true') || opts[0];

  const paintTime = () => {
    try {
      time.textContent = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', minute: '2-digit', timeZone: current.dataset.tz,
      }).format(new Date());
    } catch (_) { time.textContent = '--:--'; }
  };

  const pick = (o, focus = false) => {
    current = o;
    opts.forEach((x) => {
      const on = x === o;
      x.setAttribute('aria-checked', String(on));
      x.tabIndex = on ? 0 : -1;
    });
    city.textContent = o.dataset.city;
    coast.textContent = o.dataset.coast;
    paintTime();
    if (focus) o.focus();
    gsap.fromTo([city, coast], { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.05 });
  };

  opts.forEach((o, i) => {
    o.tabIndex = o === current ? 0 : -1;
    o.addEventListener('click', () => pick(o));
    o.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      pick(opts[(i + d + opts.length) % opts.length], true);
    });
  });

  paintTime();
  setInterval(paintTime, 20000);
}
