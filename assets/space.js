import { createNoiseAtlas } from "./noise.js";
import { onFrame, requestFrame } from "./frame.js";

export function renderSize(width, height, compact) {
  const budget = compact ? 96000 : 160000;
  const scale = Math.min(compact ? .65 : .8, Math.sqrt(budget / Math.max(1, width * height)));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function startSpace() {
  const canvas = document.querySelector("#nebula");
  const viewport = document.querySelector(".universe");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const compact = matchMedia("(max-width: 700px)").matches;
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return;
  const response = await fetch(new URL("./nebula.frag", import.meta.url));
  if (!response.ok) return;
  const fragment = await response.text();
  function shader(type, source) {
    const compiled = gl.createShader(type);
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
      gl.deleteShader(compiled);
      throw new Error("Nebula shader could not compile.");
    }
    return compiled;
  }
  const vertex = shader(gl.VERTEX_SHADER, "attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}");
  const pixel = shader(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, pixel);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(pixel);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const noiseTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, createNoiseAtlas());
  gl.uniform1i(gl.getUniformLocation(program, "u_noise"), 0);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, "u_resolution");
  const time = gl.getUniformLocation(program, "u_time");
  const pointer = gl.getUniformLocation(program, "u_pointer");
  const light = gl.getUniformLocation(program, "u_light");
  const camera = gl.getUniformLocation(program, "u_camera");
  let currentLight = document.body.dataset.theme === "light" ? 1 : 0;
  let targetLight = currentLight;
  let last = -1000;
  let pointerX = 0;
  let pointerY = 0;
  let elapsed = 8;
  let lost = false;
  let viewportHeight = 1;
  let lastCamera = -1;
  let pixelScale = 1;
  let slowFrames = 0;
  function resize() {
    viewportHeight = viewport.clientHeight || innerHeight;
    const size = renderSize(viewport.clientWidth || innerWidth, viewport.clientHeight || innerHeight, compact);
    canvas.width = Math.max(1, Math.round(size[0] * pixelScale));
    canvas.height = Math.max(1, Math.round(size[1] * pixelScale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw(performance.now(), true);
  }
  function draw(now, force = false) {
    if (lost || document.hidden) return;
    const worldY = Math.max(0,window.scrollY) / viewportHeight;
    const cameraMoved = worldY !== lastCamera;
    if (!force && !cameraMoved && now - last < (compact ? 66 : 50)) return;
    const delta = last < 0 ? 0 : Math.max(0, (now - last) / 1000);
    last = now;
    lastCamera = worldY;
    if (!motion.matches) elapsed += delta;
    const targetX = motion.matches ? 0 : Number(document.documentElement.style.getPropertyValue("--px")) || 0;
    const targetY = motion.matches ? 0 : Number(document.documentElement.style.getPropertyValue("--py")) || 0;
    const ease = motion.matches ? 1 : 1 - Math.exp(-delta / .28);
    pointerX += (targetX - pointerX) * ease;
    pointerY += (targetY - pointerY) * ease;
    currentLight += (targetLight - currentLight) * (motion.matches ? 1 : 1 - Math.exp(-delta / .18));
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, elapsed);
    gl.uniform2f(pointer, pointerX, pointerY);
    gl.uniform1f(light, currentLight);
    gl.uniform1f(camera, worldY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas.classList.add("is-ready");
  }
  function tick(now) {
    if (last > 0 && now - last > 150) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 12 && pixelScale > .6) { pixelScale *= .82; slowFrames = 0; resize(); }
    draw(now);
  }
  function resume() {
    last = -1000;
    draw(performance.now(), true);
    requestFrame();
  }
  addEventListener("resize", resize, { passive: true });
  addEventListener("portfolio-camerachange", () => {
    draw(performance.now(), true);
  });
  addEventListener("portfolio-themechange", (event) => {
    targetLight = event.detail.light ? 1 : 0;
    if (motion.matches) currentLight = targetLight;
    draw(performance.now(), true);
  });
  document.addEventListener("visibilitychange", resume);
  motion.addEventListener("change", resume);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    canvas.classList.remove("is-ready");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteTexture(noiseTexture);
    canvas.classList.remove("is-ready");
  });
  onFrame(tick,20);
  resize();
  resume();
}

if (typeof document !== "undefined") startSpace().catch(() => {});
