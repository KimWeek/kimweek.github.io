import { spaceReady } from './space.js';

export const INTRO = Object.freeze({ minimum:1000, complete:300, reveal:1500, deadline:4000 });
export function progressTarget(weight, elapsed, ready) {
  return ready && elapsed >= INTRO.minimum ? 100 : Math.min(96,Math.max(0,weight)*96);
}
export function progressStep(value,target,dt) {
  return Math.min(target,value+(target-value)*(1-Math.exp(-Math.max(0,dt)/120)));
}
export function within(promise,ms) {
  let timer;
  return Promise.race([Promise.resolve(promise).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,ms);})]).finally(()=>clearTimeout(timer));
}
export function introWireGeometry() {
  const lines=[],tau=Math.PI*2,teeth=28,base=1.05,pitch=1.12,tip=1.2,rim=[];
  function point(a,r,z){return [r*Math.cos(a),r*Math.sin(a),z];}
  function involute(r){const t=Math.sqrt(Math.max(0,(r/base)**2-1));return t-Math.atan(t);}
  const half=tau/(teeth*4)+involute(pitch);
  for(let tooth=0;tooth<teeth;tooth++){
    const center=tau*tooth/teeth;
    rim.push({angle:center-half-.015,radius:1.015},{angle:center-half,radius:1.025});
    for(let i=0;i<=4;i++){const r=base+(tip-base)*i/4;rim.push({angle:center-half+involute(r),radius:r});}
    rim.push({angle:center,radius:tip});
    for(let i=4;i>=0;i--){const r=base+(tip-base)*i/4;rim.push({angle:center+half-involute(r),radius:r});}
    rim.push({angle:center+half,radius:1.025},{angle:center+half+.015,radius:1.015});
  }
  function contour(z,inset=0){const ring=rim.map(p=>point(p.angle,p.radius-inset,z));ring.push(ring[0]);lines.push(ring);}
  function circle(radius,z){const ring=[];for(let i=0;i<=112;i++)ring.push(point(tau*i/112,radius,z));lines.push(ring);}
  contour(-.18,.018);contour(-.12);contour(.12);contour(.18,.018);
  for(let i=0;i<rim.length;i+=3){const p=rim[i];lines.push([point(p.angle,p.radius-.018,-.18),point(p.angle,p.radius,-.12),point(p.angle,p.radius,.12),point(p.angle,p.radius-.018,.18)]);}
  for(const z of [-.18,.18]){
    circle(.85,z);circle(.91,z);
    for(let i=0;i<teeth;i++){const a=tau*i/teeth;lines.push([point(a,.85,z),point(a,tip-.018,z)]);}
  }
  circle(.85,-.12);circle(.85,.12);
  for(let i=0;i<28;i++){const a=tau*i/28;lines.push([point(a,.85,-.18),point(a,.85,.18)]);}
  const hub=[[.28,-.33],[.43,-.33],[.46,-.27],[.46,.21],[.43,.27],[.28,.27]];
  hub.forEach(([r,z])=>circle(r,z));
  for(let i=0;i<28;i++){const a=tau*i/28;lines.push(hub.map(([r,z])=>point(a,r,z)));lines.push([point(a,.28,-.33),point(a,.28,.27)]);}
  for(let spoke=0;spoke<5;spoke++){
    const a=tau*spoke/5;
    function edge(s,side,z){const r=.45+.405*s,angle=a+.12*Math.sin(Math.PI*s)+side*(.105+.04*Math.sin(Math.PI*s));return point(angle,r,z);}
    for(const z of [-.16,.16]){
      const outline=[];for(let i=0;i<=10;i++)outline.push(edge(i/10,-1,z));for(let i=10;i>=0;i--)outline.push(edge(i/10,1,z));outline.push(outline[0]);lines.push(outline);
      const ridge=[];for(let i=0;i<=10;i++){const s=i/10;ridge.push(point(a+.12*Math.sin(Math.PI*s),.45+.405*s,z*(1+.15*Math.sin(Math.PI*s))));}lines.push(ridge);
      for(const s of [.22,.5,.78])lines.push([edge(s,-1,z),edge(s,1,z)]);
    }
    for(const s of [0,.33,.67,1])for(const side of [-1,1])lines.push([edge(s,side,-.16),edge(s,side,.16)]);
  }
  return lines;
}
// The shaft stays fixed. A faster local spin is independent of the slower,
// bounded camera orbit, so the gear never reads as a tumbling handheld object.
export function introGearRotation(t){return {x:.50+Math.sin(t*.33+.35)*.32,y:-.42+Math.sin(t*.42)*.58,z:-.22+Math.sin(t*.26)*.16,spin:t*1.15};}
export function bendIntroGrid(x,y,pointer,radius,strength) {
  const dx=pointer.x-x,dy=pointer.y-y,influence=Math.exp(-(dx*dx+dy*dy)/(radius*radius))*.72*strength;
  return [x+dx*influence,y+dy*influence];
}
export function createIntroGrid(stage,motion) {
  const surfaces=[...stage.querySelectorAll('[data-intro-grid]')].map(canvas=>({canvas,ctx:canvas.getContext?.('2d')})).filter(s=>s.ctx);
  if(!surfaces.length)return {paint(){},dispose(){}};
  const ink=getComputedStyle(stage).getPropertyValue('--wire-ink').trim()||'#a8c7ef';
  let width=0,height=0,ratio=1,dirty=true,last=-Infinity,disposed=false,strength=0,target=0;
  const pointer={x:0,y:0};let pointerDirty=false;
  function onResize(){dirty=true;}
  function onPointer(event){if(event.pointerType==='touch'||motion.matches)return;pointer.x=event.clientX;pointer.y=event.clientY;target=strength=1;pointerDirty=true;}
  function onLeave(event){if(!event.relatedTarget)target=0;}
  function onBlur(){target=0;}
  addEventListener('resize',onResize,{passive:true});
  addEventListener('pointermove',onPointer,{passive:true});
  addEventListener('pointerout',onLeave,{passive:true});addEventListener('blur',onBlur);
  function paint(now,force=false){
    if(disposed||(!force&&((!dirty&&!pointerDirty&&((!target&&!strength)||(target&&strength===1)))||now-last<15)))return;
    const dt=Number.isFinite(last)?Math.min(80,now-last):33;last=now;
    if(dirty){
      const rect=stage.querySelector?.('.flat-visual')?.getBoundingClientRect()||stage.getBoundingClientRect();width=rect.width;height=rect.height;if(!width||!height)return;
      ratio=Math.min(window.devicePixelRatio||1,1.25,Math.sqrt(1200000/(width*height)));
      for(const {canvas}of surfaces){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
      dirty=false;
    }
    strength+=((motion.matches?0:target)-strength)*(1-Math.exp(-dt/130));
    if(!target&&strength<.001)strength=0;
    const {ctx,canvas}=surfaces[0],spacing=width<640?48:64,radius=Math.min(330,Math.max(180,width*.16));
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.strokeStyle=ink;ctx.lineWidth=.8;ctx.globalAlpha=.13;ctx.beginPath();
    function line(horizontal,offset){
      const length=horizontal?width:height,steps=Math.ceil(length/28);
      for(let i=0;i<=steps;i++){
        const value=length*i/steps,p=bendIntroGrid(horizontal?value:offset,horizontal?offset:value,pointer,radius,strength);
        if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);
      }
    }
    for(let x=(width%spacing)/2;x<=width;x+=spacing)line(false,x);
    for(let y=(height%spacing)/2;y<=height;y+=spacing)line(true,y);
    ctx.stroke();ctx.globalAlpha=1;pointerDirty=false;
    for(const surface of surfaces.slice(1)){surface.ctx.setTransform(1,0,0,1,0,0);surface.ctx.clearRect(0,0,surface.canvas.width,surface.canvas.height);surface.ctx.drawImage(canvas,0,0);}
  }
  function dispose(){disposed=true;removeEventListener('resize',onResize);removeEventListener('pointermove',onPointer);removeEventListener('pointerout',onLeave);removeEventListener('blur',onBlur);}
  return {paint,dispose};
}
export function createIntroWireframe(stage) {
  const surfaces=[...stage.querySelectorAll('[data-intro-wire]')].map(canvas=>({canvas,ctx:canvas.getContext?.('2d')})).filter(s=>s.ctx);
  if(!surfaces.length)return {paint(){},dispose(){}};
  const lines=introWireGeometry(),ink=getComputedStyle(stage).getPropertyValue('--wire-ink').trim()||'#a8c7ef';
  let size=0,ratio=1,dirty=true,last=-Infinity,origin=performance.now(),disposed=false;
  function onResize(){dirty=true;}
  addEventListener('resize',onResize,{passive:true});
  function paint(now,force=false) {
    if(disposed||(!force&&now-last<1000/30))return;
    last=now;
    if(dirty){
      size=surfaces[0].canvas.getBoundingClientRect().width;
      if(!size)return;
      ratio=Math.min(window.devicePixelRatio||1,1.5);
      for(const {canvas}of surfaces){canvas.width=canvas.height=Math.round(size*ratio);}
      dirty=false;
    }
    const t=Math.max(0,now-origin)/1000,rotation=introGearRotation(t),elevation=rotation.x,azimuth=rotation.y,roll=rotation.z,spin=rotation.spin;
    const ce=Math.cos(elevation),se=Math.sin(elevation),ca=Math.cos(azimuth),sa=Math.sin(azimuth),cr=Math.cos(roll),sr=Math.sin(roll),cs=Math.cos(spin),ss=Math.sin(spin);
    const right=[ca,0,-sa],up=[-se*sa,ce,-se*ca],eye=[ce*sa,se,ce*ca];
    function project(p){
      // Model: rotate around its own bore. View: orbit a camera looking at origin.
      const px=p[0]*cs-p[1]*ss,py=p[0]*ss+p[1]*cs;
      const x=px*right[0]+p[2]*right[2],y=px*up[0]+py*up[1]+p[2]*up[2];
      const depth=-(px*eye[0]+py*eye[1]+p[2]*eye[2]),scale=size*.34*5/(5+depth);
      return [size/2+(x*cr-y*sr)*scale,size/2+(x*sr+y*cr)*scale,depth];
    }
    const buckets=[[],[],[]];
    for(const line of lines){let a=project(line[0]);for(let i=1;i<line.length;i++){const b=project(line[i]),depth=(a[2]+b[2])*.5;buckets[depth>.42?0:depth>-.32?1:2].push([a,b]);a=b;}}
    const {ctx,canvas}=surfaces[0];
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,size,size);ctx.strokeStyle=ink;ctx.lineWidth=.85;ctx.lineJoin='round';
    for(let i=0;i<buckets.length;i++){
      ctx.globalAlpha=[.18,.43,.86][i];ctx.beginPath();
      for(const [a,b]of buckets[i]){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}ctx.stroke();
    }
    ctx.globalAlpha=1;
    for(const surface of surfaces.slice(1)){surface.ctx.setTransform(1,0,0,1,0,0);surface.ctx.clearRect(0,0,surface.canvas.width,surface.canvas.height);surface.ctx.drawImage(canvas,0,0);}
  }
  function dispose(){disposed=true;removeEventListener('resize',onResize);}
  return {paint,dispose};
}
function startIntro() {
  const root=document.documentElement;
  if(!root.classList.contains('is-loading'))return;
  const stage=document.getElementById('entry-loader'),page=document.querySelector('.page');
  if(!stage||!page)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const touch=matchMedia('(hover: none), (pointer: coarse)').matches;
  const skip=document.getElementById('intro-skip'),progress=document.getElementById('intro-progress'),announcement=document.getElementById('intro-announcement');
  const fills=[...stage.querySelectorAll('[data-intro-fill]')],values=[...stage.querySelectorAll('[data-intro-value]')],states=[...stage.querySelectorAll('[data-intro-state]')];
  let weight=0,ready=false,phase='loading',shown=0,integer=-1,frame=0,last=performance.now(),started=last,completeTimer=0,revealTimer=0,returnFocus=false;
  const wire=createIntroWireframe(stage),grid=createIntroGrid(stage,motion);wire.paint(last,true);grid.paint(last,true);
  page.inert=true;page.setAttribute('aria-busy','true');
  function paint(value) {
    for(const fill of fills)fill.style.transform=`scaleX(${(value/100).toFixed(4)})`;
    const n=Math.floor(value);if(n===integer)return;
    integer=n;for(const node of values)node.textContent=String(n).padStart(2,'0');
    progress.setAttribute('aria-valuenow',String(n));
  }
  function finish() {
    if(phase==='done')return;
    const restoreFocus=returnFocus||document.activeElement===skip;
    phase='done';cancelAnimationFrame(frame);frame=0;wire.dispose();grid.dispose();
    clearTimeout(completeTimer);clearTimeout(revealTimer);clearTimeout(window.__kwIntroFailSafe);
    removeEventListener('keydown',onKey);removeEventListener('portfolio-intro-abort',finish);
    document.removeEventListener('visibilitychange',onVisibility);motion.removeEventListener('change',onMotion);
    dispatchEvent(new Event('portfolio-reset-top'));
    root.classList.remove('is-loading');page.inert=false;page.removeAttribute('aria-busy');stage.remove();
    if(restoreFocus)document.getElementById('info-toggle')?.focus({preventScroll:true});
    dispatchEvent(new Event('resize'));dispatchEvent(new CustomEvent('portfolio-introend'));
  }
  function open() {
    if(phase==='opening'||phase==='done')return;
    clearTimeout(completeTimer);
    returnFocus=document.activeElement===skip;skip.disabled=true;
    dispatchEvent(new Event('portfolio-reset-top'));
    phase='opening';stage.dataset.phase='opening';
    if(motion.matches||document.hidden)finish();
    else {
      revealTimer=setTimeout(finish,touch?1000:INTRO.reveal);
      if(touch){cancelAnimationFrame(frame);frame=0;wire.dispose();grid.dispose();}
      else if(!frame)frame=requestAnimationFrame(tick);
    }
  }
  function complete() {
    if(phase!=='loading')return;
    paint(100);shown=100;phase='complete';stage.dataset.phase='complete';
    for(const state of states)state.textContent='로딩 완료';
    announcement.textContent='로딩 완료';
    completeTimer=setTimeout(open,motion.matches?0:INTRO.complete);
  }
  function tick(now) {
    frame=0;
    if(!root.classList.contains('is-loading')){finish();return;}
    if(phase==='done')return;
    wire.paint(now);grid.paint(now);
    if(phase!=='loading'){frame=requestAnimationFrame(tick);return;}
    const elapsed=now-started,dt=Math.min(64,Math.max(0,now-last));last=now;
    const target=progressTarget(weight,elapsed,ready);
    shown=progressStep(shown,target,dt);paint(shown);
    if(ready&&elapsed>=INTRO.minimum&&shown>=99.6)complete();
    frame=requestAnimationFrame(tick);
  }
  function onKey(event){if(event.key==='Escape'&&phase!=='done'){event.preventDefault();open();}}
  function onVisibility(){if(document.hidden&&(phase==='opening'||phase==='complete'))finish();}
  function onMotion(){if(!motion.matches)return;if(phase==='opening')finish();else if(ready){complete();open();}}
  const domReady=document.readyState!=='loading'?Promise.resolve():new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const tasks=[{promise:domReady,weight:.15},{promise:document.fonts?.ready||Promise.resolve(),weight:.4},{promise:spaceReady,weight:.45}];
  Promise.all(tasks.map(task=>within(task.promise,INTRO.deadline).then(()=>{weight=Math.min(1,weight+task.weight);}))).then(()=>{
    ready=true;if(motion.matches&&phase==='loading'){complete();open();}
  });
  skip.addEventListener('click',open);
  addEventListener('keydown',onKey);addEventListener('portfolio-intro-abort',finish,{once:true});
  document.addEventListener('visibilitychange',onVisibility);motion.addEventListener('change',onMotion);
  paint(0);frame=requestAnimationFrame(tick);
}
if(typeof document!=='undefined')startIntro();
