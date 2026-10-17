// Scroll integration runs before every sky draw, on one shared display clock.
const jobs = [];
let frame = 0, motion;
function tick(now) {
  frame = 0;
  if (document.hidden || document.documentElement?.classList?.contains('is-loading')) return;
  for (const job of jobs) job.run(now);
  if (!motion.matches) requestFrame();
}
export function requestFrame() {
  if (!motion || document.hidden || frame) return;
  frame = requestAnimationFrame(tick);
}
export function onFrame(run, priority = 0) {
  if (!motion) {
    motion = matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else requestFrame();
    });
    motion.addEventListener('change', requestFrame);
    addEventListener('portfolio-introend', requestFrame);
    addEventListener('portfolio-intro-abort', requestFrame);
  }
  jobs.push({ run, priority }); jobs.sort((a,b) => a.priority - b.priority);
  requestFrame();
}
