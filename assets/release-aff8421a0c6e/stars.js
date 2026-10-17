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
  const sky = document.querySelector('.sky:not(.sky-distant)'), distant = document.querySelector('.sky-distant'), page = document.querySelector('.page');
  const viewport = document.querySelector('.universe');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true'); sky.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const farCanvas = document.createElement('canvas');
  farCanvas.setAttribute('aria-hidden','true');distant.append(farCanvas);
  const farCtx = farCanvas.getContext('2d',{alpha:true});
  if(!farCtx)return;
  const contexts=[ctx,farCtx];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width:700px)').matches;
  const layers = [
    { d: 8, n: compact ? 48 : 64, seed: 10, vx: 0, vy: 0, behind: true },
    { d: 4, n: compact ? 14 : 20, seed: 160, vx: 0, vy: 0, behind: true },
    { d: 2.4, n: compact ? 5 : 8, seed: 40, vx: 0, vy: 0 },
    { d: 1, n: compact ? 4 : 6, seed: 70, vx: 0, vy: 0 },
    { d: 1.25, n: 2, seed: 90, vx: -.025, vy: .023 },
    { d: 2.2, n: 2, seed: 120, vx: -.043, vy: .038 }
  ];
  let width = 1, height = 1, ratio = 1, last = -1000, elapsed = 0, lastTick = 0, lastCamera = -1;
  let color, bright, cool, warm, strength=1;
  const sprites = new Map();
  function sprite(sharp,size,tint) {
    const key = (sharp ? 's' : 'd') + size + tint;
    if(sprites.has(key))return sprites.get(key);
    // Cache a gently oversampled point-spread function. No hard white disc or
    // low-resolution cross: fractional movement keeps a soft, stable footprint.
    const image = document.createElement('canvas'); image.width = image.height = Math.ceil(size*ratio*2);
    const c = image.getContext('2d');
    c.setTransform(image.width/128,0,0,image.height/128,0,0);
    const glow = c.createRadialGradient(64,64,0,64,64,64);
    glow.addColorStop(0,bright);
    for(let i=1;i<=20;i++){
      const r=i/20,energy=(.80*Math.exp(-r*r/.045)+.12*Math.exp(-r*r/.32))*Math.sqrt(1-r);
      glow.addColorStop(r,tint+Math.round(255*energy).toString(16).padStart(2,'0'));
    }
    c.fillStyle = glow; c.fillRect(0,0,128,128);
    if (sharp) {
      c.fillStyle = tint + '60';
      c.beginPath(); c.moveTo(64,16); c.bezierCurveTo(66,59,69,62,112,64); c.bezierCurveTo(69,66,66,69,64,112);
      c.bezierCurveTo(62,69,59,66,16,64); c.bezierCurveTo(59,62,62,59,64,16); c.fill();
    }
    sprites.set(key,image);
    return image;
  }
  function theme() {
    const css = getComputedStyle(page);
    color = css.getPropertyValue('--star').trim(); bright = css.getPropertyValue('--star-bright').trim();
    cool = css.getPropertyValue('--star-cool').trim() || color; warm = css.getPropertyValue('--star-warm').trim() || color;
    strength=Number(css.getPropertyValue('--star-strength'))||1;
    sprites.clear(); draw(performance.now(), true);
  }
  function draw(now, force = false) {
    if (document.hidden || !color) return;
    const worldY = Math.max(0,window.scrollY) / height;
    const cameraMoved = worldY !== lastCamera;
    if (!force && !cameraMoved && now - last < (compact ? 15 : 32)) return;
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
    farCtx.clearRect(0,0,width,height);
    for (const layer of layers) {
      const ctx=contexts[layer.behind?1:0];
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
        const feature = hash(tx,ty,seed+i*7+2), sharp = !layer.behind && feature > .97;
        const size = sharp ? (r > .65 ? 14 : 11) : (layer.behind ? (r > .75 ? 7 : r > .35 ? 5 : 4) : (r > .75 ? 9 : r > .35 ? 7 : 5));
        const tint = feature < .16 ? warm : feature < .36 ? cool : color;
        const alpha = Math.min(.95,(layer.behind ? .25 + q * .40 : .34 + q * .45)*strength);
        const image = sprite(sharp,size,tint);
        if (vx) {
          const endX=x+7+r*10,endY=y-6-r*9,trail=ctx.createLinearGradient(x,y,endX,endY);
          trail.addColorStop(0,tint+'70');trail.addColorStop(1,tint+'00');
          ctx.globalAlpha = alpha; ctx.strokeStyle = trail; ctx.lineWidth = .65;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(endX,endY); ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        if (sharp) {
          ctx.save(); ctx.translate(x,y); ctx.rotate(feature * 6.28 + (motion.matches ? 0 : elapsed * (.025 + q * .06)));
          ctx.drawImage(image,-size*.5,-size*.5,size,size); ctx.restore();
        } else ctx.drawImage(image,x-size*.5,y-size*.5,size,size);
      }
    }
    ctx.globalAlpha = farCtx.globalAlpha = 1;
  }
  function resume() {
    lastTick = 0; last = -1000;
    draw(performance.now(),true);
    requestFrame();
  }
  function resize() {
    const w=viewport.clientWidth,h=viewport.clientHeight,nextRatio=Math.min(devicePixelRatio||1,2,Math.sqrt(6000000/Math.max(1,w*h)));
    if(width===w&&height===h&&ratio===nextRatio)return;
    width=w;height=h;ratio=nextRatio;
    for(const surface of [canvas,farCanvas]){
      surface.width=Math.round(width*ratio);surface.height=Math.round(height*ratio);
      const context=surface.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.setTransform(ratio,0,0,ratio,0,0);
    }
    sprites.clear();draw(performance.now(),true);
  }
  addEventListener('portfolio-themechange',theme);
  addEventListener('portfolio-camerachange',() => {
    if(compact&&!motion.matches)requestFrame();else draw(performance.now(),true);
  });
  addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',resume); motion.addEventListener('change',resume);
  onFrame(draw,10);
  resize(); theme(); resume();
}
if (typeof document !== 'undefined') startStars();
