import {onFrame, requestFrame} from './frame.js';

export function damp(current, target, elapsed, response = 65) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, elapsed) / response));
}

function startTitleMotion() {
  const hero = document.getElementById('intro');
  const heading = hero?.querySelector('.name');
  if (!heading) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let x = 0, y = 0, targetX = 0, targetY = 0, last = 0, dirty = false, returning = false;
  let width = 1, height = 1, centerX = 0, centerY = 0;
  function measure() {
    const bounds = hero.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    centerX = bounds.left + width / 2; centerY = bounds.top + scrollY + height / 2;
  }
  function paint() {
    heading.style.setProperty('--title-x', x.toFixed(4));
    heading.style.setProperty('--title-y', y.toFixed(4));
  }
  function reset(immediate = false) {
    targetX = targetY = 0; returning = true;
    if (immediate) { x = y = last = 0; dirty = false; paint(); }
    else { dirty = true; requestFrame(); }
  }
  hero.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') { reset(true); return; }
    if (motion.matches || !fine.matches) return;
    targetX = Math.max(-.5, Math.min(.5, (event.clientX - centerX) / width));
    targetY = Math.max(-.5, Math.min(.5, (event.clientY - (centerY - scrollY)) / height));
    returning = false; dirty = true; requestFrame();
  }, {passive: true});
  hero.addEventListener('pointerleave', () => reset());
  hero.addEventListener('pointercancel', () => reset(true));
  addEventListener('blur', () => reset());
  addEventListener('resize', () => { measure(); reset(true); }, {passive: true});
  addEventListener('portfolio-title-layout', measure);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(true); });
  motion.addEventListener('change', () => reset(true));
  fine.addEventListener('change', () => reset(true));
  onFrame(now => {
    if (!dirty) return;
    const elapsed = last ? Math.min(48, Math.max(0, now - last)) : 16.667;
    last = now;
    const response = returning ? 105 : 65;
    x = damp(x, targetX, elapsed, response); y = damp(y, targetY, elapsed, response);
    dirty = Math.abs(targetX - x) + Math.abs(targetY - y) > .0004;
    if (!dirty) { x = targetX; y = targetY; last = 0; }
    paint();
    if (dirty) requestFrame();
  }, -1);
  measure();
}

if (typeof document !== 'undefined') startTitleMotion();
