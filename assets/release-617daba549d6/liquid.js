// A single finite spring; no SVG backdrop or displacement passes.
export function springStep(value, velocity, target, dt, stiffness = 340, damping = 20) {
  dt = Math.max(0, Math.min(dt, .025));
  velocity = (velocity + (target - value) * stiffness * dt) * Math.exp(-damping * dt);
  return [value + velocity * dt, velocity];
}
function startLiquid() {
  const control = document.querySelector('.theme-toggle');
  const knob = control?.querySelector('.theme-knob');
  if (!knob) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let value = document.body.dataset.theme === 'light' ? 0 : 1;
  let target = value, velocity = 0, last = 0, frame = 0, travel = 47;
  function paint() {
    control.style.setProperty('--knob-x', `${(value * travel).toFixed(2)}px`);
    const stretch = motion.matches ? 0 : Math.min(.17, Math.abs(velocity) * .035);
    control.style.setProperty('--knob-sx', (1 + stretch).toFixed(3));
    control.style.setProperty('--knob-sy', (1 - stretch * .65).toFixed(3));
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || motion.matches) { value = target; velocity = 0; paint(); return; }
    [value, velocity] = springStep(value, velocity, target, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (Math.abs(value - target) < .0008 && Math.abs(velocity) < .004) { value = target; velocity = 0; paint(); return; }
    paint(); frame = requestAnimationFrame(tick);
  }
  function wake() { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } }
  function resize() { travel = Math.max(0, control.clientWidth - knob.offsetWidth - 8); paint(); }
  addEventListener('portfolio-themechange', event => { target = event.detail.light ? 0 : 1; wake(); });
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; value = target; velocity = 0; paint(); } });
  motion.addEventListener('change', wake);
  resize();
}
if (typeof document !== 'undefined') startLiquid();
