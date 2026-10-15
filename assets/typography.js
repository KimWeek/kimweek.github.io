export function fitScale(width, height, bounds) {
  if (!(bounds.width > 0 && bounds.height > 0)) return 1;
  const side = width <= 700 ? .86 : .76;
  const availableHeight = Math.max(24, Math.min(height * .64, height - 160));
  return Math.min(1, width * side / bounds.width, availableHeight / bounds.height);
}

export function fitTypography() {
  const page = document.getElementById("intro");
  const title = document.querySelector(".title-wrap");
  const width = page.clientWidth;
  const height = page.clientHeight;
  if (!width || !height) return;
  const heroBounds = document.getElementById("intro").getBoundingClientRect();
  const root = document.documentElement;
  const oldPointer = [root.style.getPropertyValue("--px"), root.style.getPropertyValue("--py")];
  root.style.setProperty("--px", "0");
  root.style.setProperty("--py", "0");
  title.style.setProperty("--title-scale", "1");
  title.style.setProperty("--center-y", "0px");
  const lines = [...document.querySelectorAll(".name-first-scene, .name-second-scene")];
  function inkBounds(scene) {
    const range = document.createRange();
    range.selectNodeContents(scene.querySelector(".type-face"));
    return range.getBoundingClientRect();
  }
  lines.forEach(scene => {
    scene.style.setProperty("--center-x", "0px");
    const bounds = inkBounds(scene);
    scene.style.setProperty("--center-x", `${(heroBounds.left + width / 2 - bounds.left - bounds.width / 2).toFixed(2)}px`);
  });
  const bounds = lines.map(inkBounds);
  const top = Math.min(...bounds.map(b => b.top));
  const bottom = Math.max(...bounds.map(b => b.bottom));
  const left = Math.min(...bounds.map(b => b.left));
  const right = Math.max(...bounds.map(b => b.right));
  const scale = fitScale(width, height, { width: right - left, height: bottom - top });
  const correction = (heroBounds.top + height / 2 - (top + bottom) / 2) * scale;
  title.style.setProperty("--title-scale", scale.toFixed(5));
  title.style.setProperty("--center-y", `${correction.toFixed(2)}px`);
  oldPointer.forEach((value, i) => value ? root.style.setProperty(i ? "--py" : "--px", value) : root.style.removeProperty(i ? "--py" : "--px"));
}

if (typeof document !== "undefined") {
  let frame = 0;
  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { frame = 0; fitTypography(); });
  };
  schedule();
  if (document.fonts) document.fonts.ready.then(schedule);
  addEventListener("resize", schedule, { passive: true });
  addEventListener("orientationchange", schedule, { passive: true });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(schedule).observe(document.getElementById("intro"));
}
