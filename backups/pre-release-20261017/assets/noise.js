// Two adjacent z slices share one bilinear lookup. Generated once, not per frame.
// The channels describe the same periodic 3-D lattice, shifted by one z step.
export function createNoiseAtlas() {
  const size = 256;
  const lattice = new Uint8Array(size * size);
  let seed = 0x4b574545;
  for (let i = 0; i < lattice.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    lattice[i] = seed >>> 24;
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    pixels[index] = lattice[y * size + x];
    pixels[index + 1] = lattice[((y + 59) & 255) * size + ((x + 37) & 255)];
    pixels[index + 3] = 255;
  }
  return pixels;
}
