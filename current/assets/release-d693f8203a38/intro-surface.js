export function splitDistance(t) {
  t=Math.max(0,Math.min(1,t));
  let low=0,high=1,u=t;
  for(let i=0;i<16;i++){
    const x=3*.76*(1-u)**2*u+3*.24*(1-u)*u*u+u**3;
    if(x<t)low=u;else high=u;
    u=(low+high)/2;
  }
  return 3*(1-u)*u*u+u**3;
}

// One complete image is painted before it is split. Text, gauge and geometry
// can never be independently clipped or promoted into mismatched GPU layers.
export function createIntroSurface(stage,motion) {
  if(!stage.querySelector||typeof document.createElement!=='function')return null;
  const template=stage.querySelector('.flat-panel-left .flat-visual');
  if(!template)return null;
  const canvas=document.createElement('canvas'),scene=document.createElement('canvas'),gridLayer=document.createElement('canvas');
  const ctx=canvas.getContext('2d'),source=scene.getContext('2d'),gridCtx=gridLayer.getContext('2d');
  if(!ctx||!source||!gridCtx)return null;
  canvas.className='intro-surface';canvas.setAttribute('aria-hidden','true');
  stage.append(canvas);stage.classList.add('is-composited');
  let width=0,height=0,ratio=1,dirty=true,layout,opening=-1,disposed=false;
  const origin=performance.now(),duration=1200;
  const nodes={grid:template.querySelector('[data-intro-grid]'),wire:template.querySelector('[data-intro-wire]'),
    heading:[...template.querySelectorAll('.flat-heading>span')],state:template.querySelector('[data-intro-state]'),
    value:template.querySelector('[data-intro-value]'),percent:template.querySelector('.flat-percent'),meter:template.querySelector('.flat-meter')};
  function invalidate(){dirty=true;}
  function measure(){
    const bounds=stage.getBoundingClientRect();
    width=bounds.width;height=bounds.height;
    if(!width||!height)return false;
    ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(6000000/(width*height)));
    const w=Math.round(width*ratio),h=Math.round(height*ratio);
    for(const target of [canvas,scene,gridLayer])if(target.width!==w||target.height!==h){target.width=w;target.height=h;}
    function box(node){const r=node.getBoundingClientRect();return {x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height};}
    function text(node){const style=getComputedStyle(node);return {node,...box(node),font:`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,spacing:style.letterSpacing,color:style.color,align:style.textAlign};}
    const style=getComputedStyle(stage);
    layout={paper:style.getPropertyValue('--flat-paper').trim(),ink:style.getPropertyValue('--flat-ink').trim(),rule:style.getPropertyValue('--intro-rule').trim(),
      grid:box(nodes.grid),wire:box(nodes.wire),heading:nodes.heading.map(text),state:text(nodes.state),value:text(nodes.value),percent:text(nodes.percent),meter:box(nodes.meter)};
    gridCtx.setTransform(ratio,0,0,ratio,0,0);gridCtx.clearRect(0,0,width,height);
    dirty=false;return true;
  }
  function drawText(item,alpha=1,offset=0){
    source.font=item.font;source.textBaseline='alphabetic';source.fillStyle=item.color;source.globalAlpha=alpha;
    source.letterSpacing=item.spacing==='normal'?'0px':item.spacing;
    const metrics=source.measureText(item.node.textContent),ascent=metrics.fontBoundingBoxAscent??metrics.actualBoundingBoxAscent,
      descent=metrics.fontBoundingBoxDescent??metrics.actualBoundingBoxDescent;
    const baseline=item.y+(item.height-ascent-descent)/2+ascent+offset;
    source.textAlign=item.align==='right'?'right':'left';
    source.fillText(item.node.textContent,item.x+(item.align==='right'?item.width:0),baseline);
    source.globalAlpha=1;
  }
  function paint(now,value){
    if(disposed||(dirty&&!measure()))return;
    source.setTransform(ratio,0,0,ratio,0,0);source.globalAlpha=1;source.fillStyle=layout.paper;source.fillRect(0,0,width,height);
    const grid=layout.grid;
    gridCtx.setTransform(ratio,0,0,ratio,0,0);gridCtx.globalCompositeOperation='source-over';gridCtx.clearRect(0,0,width,height);
    if(nodes.grid.width&&nodes.grid.height)gridCtx.drawImage(nodes.grid,grid.x,grid.y,grid.width,grid.height);
    gridCtx.save();gridCtx.translate(width/2,height/2);gridCtx.scale(width/2,height/2);
    const mask=gridCtx.createRadialGradient(0,0,.2,0,0,.95);mask.addColorStop(0,'#000');mask.addColorStop(1,'#0000');
    gridCtx.globalCompositeOperation='destination-in';gridCtx.fillStyle=mask;gridCtx.fillRect(-1,-1,2,2);gridCtx.restore();
    source.drawImage(gridLayer,0,0,width,height);
    const arrive=motion.matches?1:Math.min(1,Math.max(0,(now-origin)/700)),ease=1-(1-arrive)**4;
    const gear=layout.wire;
    if(nodes.wire.width&&nodes.wire.height){source.globalAlpha=ease;source.drawImage(nodes.wire,gear.x,gear.y+(1-ease)*8,gear.width,gear.height);source.globalAlpha=1;}
    layout.heading.forEach((item,i)=>{
      const t=motion.matches?1:Math.max(0,Math.min(1,(now-origin-i*80)/700)),a=1-(1-t)**4;
      drawText(item,a,(1-a)*14);
    });
    for(const item of [layout.state,layout.value,layout.percent])drawText(item);
    const bar=layout.meter,y=Math.round(bar.y*ratio)/ratio,h=Math.max(bar.height,1/ratio);
    source.fillStyle=layout.rule;source.fillRect(bar.x,y,bar.width,h);
    source.fillStyle=layout.ink;source.fillRect(bar.x,y,bar.width*Math.max(0,Math.min(100,value))/100,h);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    if(opening<0){ctx.drawImage(scene,0,0);return;}
    const travel=Math.round(canvas.width*.51*splitDistance((now-opening)/duration)),half=Math.floor(canvas.width/2);
    ctx.drawImage(scene,0,0,half,scene.height,-travel,0,half,scene.height);
    ctx.drawImage(scene,half,0,scene.width-half,scene.height,half+travel,0,scene.width-half,scene.height);
  }
  function open(now){opening=now;}
  function dispose(){disposed=true;removeEventListener('resize',invalidate);canvas.remove();scene.width=scene.height=gridLayer.width=gridLayer.height=1;}
  addEventListener('resize',invalidate,{passive:true});document.fonts?.ready.then(invalidate);
  return {paint,open,dispose};
}
