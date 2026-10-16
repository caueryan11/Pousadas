/**
 * cards.js — micro-interactions for the project cards.
 *  - gentle idle float (each card on its own rhythm)
 *  - pointer tilt + cursor-following sheen (fine pointers only)
 */
export function initCards(cards, { gsap }) {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  cards.forEach((card, i) => {
    const link = card.querySelector('.card__link');
    if (!link) return;

    // Idle float — on the link, so it never fights the scroll tween on the <li>.
    gsap.to(link, {
      y: i % 2 ? -10 : 10,
      duration: 2.6 + i * 0.35,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    if (!finePointer) return;

    const rx = gsap.quickTo(link, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(link, 'rotationY', { duration: 0.6, ease: 'power3.out' });

    link.addEventListener('pointermove', (e) => {
      const r = link.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      rx((0.5 - py) * 8);
      ry((px - 0.5) * 10);
      link.style.setProperty('--mx', `${px * 100}%`);
      link.style.setProperty('--my', `${py * 100}%`);
    });
    link.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}
