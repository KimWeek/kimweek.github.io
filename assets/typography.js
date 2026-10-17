export function fitScale(width, height, bounds) {
  if (!(bounds.width > 0 && bounds.height > 0)) return 1;
  const side = width <= 700 ? .86 : .76;
  const availableHeight = Math.max(24, Math.min(height * .64, height - 160));
  return Math.min(1, width * side / bounds.width, availableHeight / bounds.height);
}

// A projective glyph shape, independent of the word's mouse-only 3D rotation.
// Foreshortening compresses the visible height of the receding letter plane.
export function typeProjection(height, topScale, bottomScale, foreshortening = .7) {
  if (!(height > 0 && topScale > 0 && bottomScale > 0)
      || ![height, topScale, bottomScale].every(Number.isFinite)) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }
  const scale = 2 * topScale * bottomScale / (topScale + bottomScale);
  const perspective = 2 * (topScale - bottomScale) / (height * (topScale + bottomScale));
  return [scale, 0, 0, 0, 0, foreshortening, 0, perspective, 0, 0, 1, 0, 0, foreshortening * perspective * height * height / 4, 0, 1];
}

export function fitTypography() {
  const page = document.getElementById("intro");
  const title = document.querySelector(".title-wrap");
  const width = page.clientWidth;
  const height = page.clientHeight;
  if (!width || !height) return;
  const heroBounds = document.getElementById("intro").getBoundingClientRect();
  const heading = title.querySelector(".name");
  const oldPointer = [heading.style.getPropertyValue("--title-x"), heading.style.getPropertyValue("--title-y")];
  heading.style.setProperty("--title-x", "0");
  heading.style.setProperty("--title-y", "0");
  title.style.removeProperty("--view-x");
  title.style.removeProperty("--view-y");
  title.style.setProperty("--title-scale", "1");
  title.style.setProperty("--center-y", "0px");
  const lines = [...document.querySelectorAll(".name-first-scene, .name-second-scene")];
  const week = lines[1];
  week.style.setProperty("--week-font-size", getComputedStyle(lines[0].querySelector("[data-word]")).fontSize);
  week.style.setProperty("--line-gap", "0px");
  lines.forEach(scene => scene.style.setProperty("--center-x", "0px"));
  function shapeLine(scene) {
    const shape = scene.querySelector(".type-shape");
    const matrix = typeProjection(parseFloat(getComputedStyle(shape).height), Number(shape.dataset.topScale), Number(shape.dataset.bottomScale));
    shape.style.setProperty("--type-projection", `matrix3d(${matrix.join(",")})`);
    const style = getComputedStyle(shape);
    const fontSize = parseFloat(style.fontSize);
    const tracking = parseFloat(style.letterSpacing) || 0;
    // DM Serif Display: 1036 ascent, 335 descent, 660 cap height / 1000 UPM.
    const baseline = (parseFloat(style.lineHeight) - fontSize * 1.371) / 2 + fontSize * 1.036;
    const word = scene.querySelector("[data-word]");
    const first = word.dataset.word === "KIM";
    const left = fontSize * (first ? .022 : .004);
    const right = fontSize * (first ? 1.724 : 2.676) + tracking * (first ? 2 : 3);
    const top = baseline - fontSize * .66;
    const bottom = baseline + fontSize * (first ? 0 : .003);
    if (!shape.querySelector(".type-corner")) {
      for (let i = 0; i < 8; i += 1) {
        const corner = document.createElement("span");
        corner.className = "type-corner";
        shape.append(corner);
      }
    }
    shape.querySelectorAll(".type-corner").forEach((corner, i) => {
      const depth = i < 4 ? 0 : Number(word.dataset.depth) * fontSize;
      corner.style.left = `${(i % 2 ? right : left) + depth * .16}px`;
      corner.style.top = `${(i % 4 < 2 ? top : bottom) + depth * .65}px`;
      corner.style.transform = `translateZ(${depth ? -depth : .1}px)`;
    });
  }
  shapeLine(lines[0]);
  // Match visible letter heights; WEEK keeps its naturally wider four-letter shape.
  for (let pass = 0; pass < 3; pass += 1) {
    shapeLine(week);
    const ratio = inkBounds(lines[0]).height / inkBounds(week).height;
    if (!(ratio > 0 && Number.isFinite(ratio))) break;
    const fontSize = parseFloat(getComputedStyle(week).fontSize);
    week.style.setProperty("--week-font-size", `${fontSize * ratio}px`);
    shapeLine(week);
    const firstBounds = inkBounds(lines[0]);
    const secondBounds = inkBounds(week);
    const gap = Math.max(3, Math.min(8, firstBounds.height * .03));
    const currentMargin = parseFloat(week.style.getPropertyValue("--line-gap"));
    week.style.setProperty("--line-gap", `${currentMargin + gap - (secondBounds.top - firstBounds.bottom)}px`);
  }
  shapeLine(week);
  function inkBounds(scene) {
    const bounds = [...scene.querySelectorAll(".type-corner")].map(corner => corner.getBoundingClientRect());
    const left = Math.min(...bounds.map(b => b.left));
    const right = Math.max(...bounds.map(b => b.right));
    const top = Math.min(...bounds.map(b => b.top));
    const bottom = Math.max(...bounds.map(b => b.bottom));
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }
  lines.forEach(scene => {
    const bounds = inkBounds(scene);
    scene.style.setProperty("--center-x", `${heroBounds.left + width / 2 - (bounds.left + bounds.right) / 2}px`);
  });
  let bounds = lines.map(inkBounds);
  const headingBox = heading.getBoundingClientRect();
  const pivotX = (Math.min(...bounds.map(b => b.left)) + Math.max(...bounds.map(b => b.right))) / 2 - headingBox.left;
  const pivotY = (Math.min(...bounds.map(b => b.top)) + Math.max(...bounds.map(b => b.bottom))) / 2 - headingBox.top;
  heading.style.setProperty("--pivot-x", `${pivotX}px`);
  heading.style.setProperty("--pivot-y", `${pivotY}px`);
  title.style.setProperty("--view-x", `${pivotX}px`);
  title.style.setProperty("--view-y", `${pivotY}px`);
  bounds = lines.map(inkBounds);
  const top = Math.min(...bounds.map(b => b.top));
  const bottom = Math.max(...bounds.map(b => b.bottom));
  const left = Math.min(...bounds.map(b => b.left));
  const right = Math.max(...bounds.map(b => b.right));
  const scale = fitScale(width, height, { width: right - left, height: bottom - top });
  const correction = (heroBounds.top + height / 2 - (top + bottom) / 2) * scale;
  title.style.setProperty("--title-scale", scale.toFixed(5));
  title.style.setProperty("--center-y", `${correction.toFixed(2)}px`);
  oldPointer.forEach((value, i) => value ? heading.style.setProperty(i ? "--title-y" : "--title-x", value) : heading.style.removeProperty(i ? "--title-y" : "--title-x"));
  dispatchEvent(new Event('portfolio-title-layout'));
}

if (typeof document !== "undefined") {
  const hero = document.getElementById("intro");
  let frame = 0, lastWidth = -1, lastHeight = -1, forceFit = false;
  const schedule = (force = false) => {
    forceFit ||= force;
    if (!forceFit && hero.clientWidth === lastWidth && hero.clientHeight === lastHeight) return;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!forceFit && hero.clientWidth === lastWidth && hero.clientHeight === lastHeight) return;
      forceFit = false; lastWidth = hero.clientWidth; lastHeight = hero.clientHeight;
      fitTypography();
    });
  };
  schedule();
  if (document.fonts) document.fonts.ready.then(() => schedule(true));
  addEventListener("resize", () => schedule(), { passive: true });
  addEventListener("orientationchange", () => schedule(true), { passive: true });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => schedule()).observe(hero);
}
