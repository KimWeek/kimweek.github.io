import { onFrame, requestFrame } from './frame.js';

// Infinite seeded world tiles, not screen-bound particles. Camera Y grows downward.
export function hash(x, y, seed = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function projectStar(x, y, cameraX, cameraY, distance, width, height) {
  return [width * .5 + (x - cameraX) / distance * height, height * .5 + (y - cameraY) / distance * height];
}
function startStars() {
  const sky = document.querySelector('.sky'), page = document.querySelector('.page');
  const viewport = document.querySelector('.universe');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true'); sky.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width:700px)').matches;
  const layers = [
    { d: 5, n: compact ? 6 : 10, seed: 10, vx: 0, vy: 0 },
    { d: 2.4, n: compact ? 5 : 8, seed: 40, vx: 0, vy: 0 },
    { d: 1, n: compact ? 4 : 6, seed: 70, vx: 0, vy: 0 },
    { d: 1.25, n: 2, seed: 90, vx: -.025, vy: .023 },
    { d: 2.2, n: 2, seed: 120, vx: -.043, vy: .038 }
  ];
  let width = 1, height = 1, last = -1000, elapsed = 0, lastTick = 0, lastCamera = -1;
  let dot, spark, color, bright;
  function sprite(sharp) {
    const image = document.createElement('canvas'); image.width = image.height = 128;
    const c = image.getContext('2d');
    const glow = c.createRadialGradient(64,64,0,64,64,64);
    glow.addColorStop(0, color); glow.addColorStop(.07, color); glow.addColorStop(.18, color + '60'); glow.addColorStop(.4, color + '18'); glow.addColorStop(1, color + '00');
    c.globalAlpha = sharp ? .45 : .8; c.fillStyle = glow; c.fillRect(0,0,128,128); c.globalAlpha = 1;
    c.fillStyle = bright;
    if (sharp) {
      c.beginPath(); c.moveTo(64,9); c.bezierCurveTo(66,59,69,62,119,64); c.bezierCurveTo(69,66,66,69,64,119);
      c.bezierCurveTo(62,69,59,66,9,64); c.bezierCurveTo(59,62,62,59,64,9); c.fill();
    } else { c.beginPath(); c.arc(64,64,7,0,Math.PI*2); c.fill(); }
    return image;
  }
  function theme() {
    const css = getComputedStyle(page);
    color = css.getPropertyValue('--star').trim(); bright = css.getPropertyValue('--star-bright').trim();
    dot = sprite(false); spark = sprite(true); draw(performance.now(), true);
  }
  function draw(now, force = false) {
    if (document.hidden || !dot) return;
    const worldY = Math.max(0,window.scrollY) / height;
    const cameraMoved = worldY !== lastCamera;
    if (!force && !cameraMoved && now - last < 32) return;
    const dt = lastTick ? Math.max(0,Math.min(.1,(now - lastTick) / 1000)) : 0;
    lastTick = now; last = now;
    lastCamera = worldY;
    if (!motion.matches) elapsed += dt;
    const style = document.documentElement.style;
    const px = motion.matches ? 0 : Number(style.getPropertyValue('--px')) || 0;
    const py = motion.matches ? 0 : Number(style.getPropertyValue('--py')) || 0;
    const cameraX = px * .035;
    const cameraY = worldY + py * .03;
    ctx.clearRect(0,0,width,height);
    for (const layer of layers) {
      const { d, n, seed, vx, vy } = layer;
      const cx = cameraX - vx * elapsed, cy = cameraY - vy * elapsed;
      const left = Math.floor((cx - width / height * d * .5) / d) - 1;
      const right = Math.floor((cx + width / height * d * .5) / d) + 1;
      const top = Math.floor((cy - d * .5) / d) - 1;
      const bottom = Math.floor((cy + d * .5) / d) + 1;
      for (let tx = left; tx <= right; tx++) for (let ty = top; ty <= bottom; ty++) for (let i = 0; i < n; i++) {
        const r = hash(tx, ty, seed + i * 7), q = hash(tx, ty, seed + i * 7 + 1);
        const [x,y] = projectStar((tx + r) * d, (ty + q) * d, cx, cy, d, width, height);
        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) continue;
        const feature = hash(tx,ty,seed+i*7+2), sharp = feature > .79 || vx !== 0;
        const size = sharp ? (feature > .96 ? 42 : 13 + feature * 10) * (compact ? .8 : 1) : 6 + r * 5;
        const alpha = (.28 + q * .55) * (motion.matches ? 1 : .86 + .14 * Math.sin(elapsed * (.5+r) + feature * 30));
        if (vx) {
          ctx.globalAlpha = alpha * .24; ctx.strokeStyle = color; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x + 9 + r * 14,y - 8 - r * 12); ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        if (sharp) {
          ctx.save(); ctx.translate(x,y); ctx.rotate(feature * 6.28 + (motion.matches ? 0 : elapsed * (.025 + q * .06)));
          ctx.drawImage(spark,-size*.5,-size*.5,size,size); ctx.restore();
        } else ctx.drawImage(dot,x-size*.5,y-size*.5,size,size);
      }
    }
    ctx.globalAlpha = 1;
  }
  function resume() {
    lastTick = 0; last = -1000;
    draw(performance.now(),true);
    requestFrame();
  }
  function resize() {
    width = viewport.clientWidth; height = viewport.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1,1.5);
    canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0); draw(performance.now(),true);
  }
  addEventListener('portfolio-themechange',theme);
  addEventListener('portfolio-camerachange',() => {
    draw(performance.now(),true);
  });
  addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',resume); motion.addEventListener('change',resume);
  onFrame(draw,10);
  resize(); theme(); resume();
}
if (typeof document !== 'undefined') startStars();
