precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_light;
uniform float u_camera;
uniform sampler2D u_noise;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise3(vec3 p) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 address = cell.xy + cell.z * vec2(37.0, 59.0);
  vec2 slices = texture2D(u_noise, (address + f.xy + 0.5) / 256.0).rg;
  return mix(slices.r, slices.g, f.z);
}

// Nonperiodic adaptation of PSRDnoise, (c) 2021 Stefan Gustavson and Ian McEwan.
// MIT license: /assets/THIRD-PARTY-NOTICES.txt; github.com/stegu/psrdnoise
float flowNoise(vec2 x, float alpha, out vec2 gradient) {
  vec2 uv = vec2(x.x + x.y * 0.5, x.y);
  vec2 i0 = floor(uv);
  vec2 f0 = fract(uv);
  float cmp = step(f0.y, f0.x);
  vec2 o1 = vec2(cmp, 1.0 - cmp);
  vec2 i1 = i0 + o1;
  vec2 i2 = i0 + 1.0;
  vec2 v0 = vec2(i0.x - i0.y * 0.5, i0.y);
  vec2 x0 = x - v0;
  vec2 x1 = x - (v0 + vec2(o1.x - o1.y * 0.5, o1.y));
  vec2 x2 = x - (v0 + vec2(0.5, 1.0));
  vec3 iu = vec3(i0.x, i1.x, i2.x);
  vec3 iv = vec3(i0.y, i1.y, i2.y);
  vec3 h = mod(iu, 289.0);
  h = mod((h * 51.0 + 2.0) * h + iv, 289.0);
  h = mod((h * 34.0 + 10.0) * h, 289.0);
  vec3 angle = h * 0.07482 + alpha;
  vec3 gx = cos(angle), gy = sin(angle);
  vec2 g0 = vec2(gx.x, gy.x), g1 = vec2(gx.y, gy.y), g2 = vec2(gx.z, gy.z);
  vec3 w = max(0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  vec3 w2 = w * w, w4 = w2 * w2;
  vec3 ramp = vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2));
  vec3 dw = -8.0 * w2 * w * ramp;
  gradient = 10.9 * (w4.x * g0 + dw.x * x0 + w4.y * g1 + dw.y * x1 + w4.z * g2 + dw.z * x2);
  return 10.9 * dot(w4, ramp);
}

// Each octave changes along its own time axis: detail evolves inside the cloud.
float clouds(vec3 p, float t) {
  mat3 turn = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
  float value = 0.0;
  float weight = 0.50;
  for (int octave = 0; octave < 4; octave++) {
    value += weight * noise3(p + vec3(0.0, 0.0, t * (0.65 + float(octave) * 0.16)));
    p = turn * p * 2.03 + vec3(7.1, 13.7, 3.9);
    weight *= 0.52;
  }
  return value * 1.0357;
}

// A separate star population at every depth, composited between gas samples.
// Coordinates stay fixed in space while the volume can flow in front of them.
vec3 depthStars(vec2 screen, float distance, float layer) {
  vec2 view = screen + (u_pointer * vec2(0.027, -0.027) + vec2(0.0, -u_camera)) / distance;
  float scale = 115.0 + layer * 11.0;
  vec2 grid = view * scale + vec2(layer * 37.13, layer * 19.71);
  vec2 base = floor(grid - 0.5);
  float cellSize = u_resolution.y / scale;
  vec3 stars = vec3(0.0);
  // Neighbouring cells keep bright cores and glow continuous across boundaries.
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
    vec2 cell = base + vec2(float(x), float(y));
    float seed = hash(cell + 91.7 + layer * 31.13);
    if (seed > 0.9978) {
      vec2 center = vec2(hash(cell), hash(cell + 23.8)) * 0.68 + 0.16;
      vec2 offset = (grid - cell - center) * cellSize;
      float magnitude = hash(cell + 53.19 + layer * 8.7);
      float bright = pow(magnitude, 7.0);
      float radius = min(0.40 + bright * 0.55, cellSize * 0.21);
      float r2 = dot(offset, offset);
      float core = exp(-r2 / (radius * radius));
      float halo = exp(-r2 / (cellSize * cellSize * 0.0784)) * bright * 0.12;
      float twinkle = 0.96 + sin(u_time * 0.30 + seed * 120.0) * 0.04;
      vec3 tint = mix(vec3(1.0, 0.86, 0.70), vec3(0.72, 0.85, 1.0), smoothstep(0.12, 0.62, magnitude));
      stars += tint * (core + halo) * (0.18 + bright * 1.3) * twinkle;
    }
  }
  return stars;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 screen = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * 0.065;
  vec3 radiance = vec3(0.0);
  float transmission = 1.0;
  float opticalDepth = 0.0;

  // Integrate near to far through the volume. Perspective, opacity and local
  // illumination separate the distances; there is no single moving cloud plane.
  for (int slice = 0; slice < 4; slice++) {
    float far = float(slice) / 3.0;
    float phase = t * mix(1.35, 0.45, far);
    float distance = 0.75 + float(slice) * 1.0;
    float parallax = 0.027 / distance;
    vec2 view = screen + u_pointer * vec2(parallax, -parallax);
    vec3 p = vec3((view * distance + vec2(0.0, -u_camera)) * 1.55, distance * 1.9 + 8.0);

    // A slow, spatially varying current bends the density field, rather than
    // translating a finished picture. Neighbouring depths have different phases.
    vec2 gradient;
    float eddy = flowNoise(p.xy * 0.78 + vec2(p.z * 0.23, p.z * 0.41), phase * 0.72, gradient);
    vec3 flow = vec3(gradient.y, -gradient.x, eddy) * 0.14;
    vec3 field = p + flow;
    float billow = clouds(field, phase);
    float detail = noise3(field * vec3(5.8, 9.0, 6.5) + vec3(0.0, phase * 0.18, -phase * 0.32)) * 0.62;
    detail += noise3(field.yzx * 13.5 + flow * 2.0 + vec3(3.0, 7.0, phase * 0.26)) * 0.38;
    detail = mix(detail, 0.5, far * 0.58);
    float veil = noise3(p * 0.55 + vec3(13.0, 2.0, phase * 0.14));
    float density = smoothstep(0.39, 0.72, billow) * mix(0.28, 1.0, veil);
    density *= mix(0.74, 1.08, detail);

    // Dark dust in front of illuminated gas adds occlusion, not just blue haze.
    float dust = smoothstep(0.48, 0.80, noise3(field * 2.2 + vec3(4.0, 8.0, 1.0)));
    float nearVeil = mix(0.62, 1.0, smoothstep(0.0, 0.38, far));
    float opacity = 1.0 - exp(-density * (0.31 + dust * 0.24) * nearVeil * 1.20);
    float lightSide = noise3(field * 1.05 + vec3(0.22, 0.38, -0.31));
    float silver = smoothstep(0.44, 0.73, billow + (lightSide - 0.5) * 0.23);
    vec3 firstLight = (p - vec3(1.25, 0.6, 12.4)) * vec3(0.65, 0.8, 0.55);
    vec3 secondLight = (p - vec3(-1.6, -0.7, 10.7)) * vec3(0.8, 1.0, 0.65);
    float illumination = 0.36 + exp(-dot(firstLight, firstLight)) * 1.55
                               + exp(-dot(secondLight, secondLight)) * 0.9;
    vec3 lightDirection = normalize(vec3(1.25, 0.6, 12.4) - p);
    float shadowDensity = noise3(field + lightDirection * 0.28 + vec3(0.0, 0.0, phase * 0.65));
    float selfShadow = exp(-max(shadowDensity - billow, 0.0) * 7.0);
    illumination *= 0.32 + selfShadow * 0.68;
    float filaments = pow(smoothstep(0.40, 0.78, detail), 2.0) * smoothstep(0.43, 0.68, billow);
    vec3 blue = mix(vec3(0.020, 0.065, 0.190), vec3(0.110, 0.335, 0.510), silver);
    blue = mix(blue, vec3(0.030, 0.098, 0.255), far * 0.32);
    vec3 gas = blue * (0.56 + silver * 1.8) * illumination;
    gas += vec3(0.075, 0.220, 0.320) * filaments * illumination;
    gas *= 1.0 - dust * 0.72;
    radiance += transmission * gas * opacity;
    opticalDepth += transmission * opacity;
    transmission *= 1.0 - opacity;
    vec3 starTransmission = pow(vec3(transmission), vec3(0.86, 1.0, 1.18));
    radiance += starTransmission * depthStars(screen, distance + 0.215, float(slice));
  }

  vec3 deep = vec3(0.006, 0.013, 0.033);
  vec3 color = radiance + transmission * (deep + depthStars(screen, 6.0, 9.0));
  float vignette = 1.0 - smoothstep(0.30, 1.04, length((uv - 0.5) * vec2(0.84, 1.0)));
  color *= 0.68 + vignette * 0.32;
  vec3 day = vec3(0.960, 0.956, 0.944) - opticalDepth * vec3(0.085, 0.080, 0.064) + radiance * 0.10;
  color = mix(color, day, u_light);
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
