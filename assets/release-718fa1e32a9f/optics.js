export function lensGeometry(x, y, width, height, corner = Math.min(width, height) / 2) {
  const radius = Math.max(1, Math.min(corner, width / 2, height / 2));
  const px = x - width / 2, py = y - height / 2;
  const qx = Math.abs(px) - (width / 2 - radius);
  const qy = Math.abs(py) - (height / 2 - radius);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  const length = Math.hypot(ox, oy);
  const distance = length + Math.min(Math.max(qx, qy), 0) - radius;
  const nx = length > 0 ? ox / length * Math.sign(px) : qx > qy ? Math.sign(px) : 0;
  const ny = length > 0 ? oy / length * Math.sign(py) : qx > qy ? 0 : Math.sign(py);
  return { depth: -distance, nx, ny, bezel: Math.min(radius * .72, 18) };
}

export function refractionProfile(bezel, ior = 1.46) {
  return Array.from({ length: 256 }, (_, i) => {
    const t = (i + .5) / 256;
    const arc = 1 - (1 - t) ** 4;
    const surface = arc ** .25;
    const slope = (1 - t) ** 3 / arc ** .75 * .8;
    const nz = 1 / Math.sqrt(1 + slope * slope);
    const nr = slope * nz;
    const eta = 1 / ior;
    const bend = eta * nz - Math.sqrt(1 - eta * eta * (1 - nz * nz));
    const rx = bend * nr, rz = -eta + bend * nz;
    const travel = bezel * (.8 + surface * .8) / Math.max(.05, -rz);
    const fade = Math.min(1, t / .07);
    return Math.min(bezel * .84, -rx * travel) * fade * fade * (3 - 2 * fade);
  });
}

export function lensSample(x, y, width, height, corner, profile) {
  const field = lensGeometry(x, y, width, height, corner);
  if (field.depth <= 0 || field.depth >= field.bezel) return [0, 0, 0];
  const t = field.depth / field.bezel;
  const table = profile || refractionProfile(field.bezel);
  const index = Math.min(254, t * 255);
  const a = Math.floor(index), fraction = index - a;
  const displacement = table[a] * (1 - fraction) + table[a + 1] * fraction;
  const light = Math.max(0, -field.nx * .65 - field.ny * .76) ** 4;
  const opposite = Math.max(0, field.nx * .65 + field.ny * .76) ** 6;
  const shine = (light * .5 + opposite * .17) * Math.sin(Math.PI * t) ** .65;
  return [-field.nx * displacement, -field.ny * displacement, shine];
}

export function knobTravel(clientWidth, knobWidth, inset = 4) {
  return Math.max(0, clientWidth - inset * 2 - knobWidth);
}
