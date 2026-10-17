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

// Stars render at display resolution on either side of this translucent gas pass.

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
    vec3 coolGas = mix(vec3(0.023, 0.037, 0.105), vec3(0.155, 0.205, 0.345), silver);
    coolGas = mix(coolGas, vec3(0.028, 0.045, 0.150), far * 0.32);
    float dusk = smoothstep(0.42, 0.69, noise3(p * 0.56 + vec3(3.7, 8.2, 1.3)));
    vec3 duskGas = mix(vec3(0.075, 0.037, 0.078), vec3(0.265, 0.170, 0.265), silver);
    vec3 gas = mix(coolGas, duskGas, dusk * 0.40) * (0.56 + silver * 1.8) * illumination;
    gas += mix(vec3(0.135, 0.160, 0.280), vec3(0.220, 0.145, 0.235), dusk) * filaments * illumination;
    gas *= 1.0 - dust * 0.72;
    radiance += transmission * gas * opacity;
    opticalDepth += transmission * opacity;
    transmission *= 1.0 - opacity;
  }

  float vignette = 1.0 - smoothstep(0.30, 1.04, length((uv - 0.5) * vec2(0.84, 1.0)));
  vec3 night = radiance * (0.68 + vignette * 0.32);
  vec3 day = vec3(0.62, 0.68, 0.80) * opticalDepth * 0.60;
  float alpha = opticalDepth * mix(1.0, 0.60, u_light);
  vec3 color = mix(night, day, u_light) + (hash(gl_FragCoord.xy) - 0.5) * alpha / 255.0;
  gl_FragColor = vec4(max(vec3(0.0),color),alpha);
}
