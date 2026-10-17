import {onFrame,requestFrame} from './frame.js';

export function cardCoordinates(x,y,rect){return [Math.max(-.5,Math.min(.5,(x-rect.left)/Math.max(1,rect.width)-.5)),Math.max(-.5,Math.min(.5,(y-rect.top)/Math.max(1,rect.height)-.5))];}
function startInteraction(){
  const section=document.getElementById('info'),content=section?.querySelector('.info-content');if(!content)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)');
  const cards=[...section.querySelectorAll('.info-panel,.info-link')].map(node=>({node,x:0,y:0,tx:0,ty:0}));
  let active=null,rect=null,groupX=0,groupY=0,targetX=0,targetY=0,dirty=false,last=0;
  function reset(){for(const card of cards){card.tx=0;card.ty=0;}active=null;rect=null;targetX=targetY=0;dirty=true;requestFrame();}
  section.addEventListener('pointermove',event=>{
    if(motion.matches||!fine.matches||event.pointerType==='touch')return;
    targetX=(event.clientX/innerWidth-.5)*9;targetY=(event.clientY/innerHeight-.5)*6;
    const target=event.target.closest?.('.info-panel,.info-link');
    const next=cards.find(card=>card.node===target)||null;
    if(next!==active){if(active){active.tx=active.ty=0;active.node.classList.remove('is-pointed');}active=next;rect=null;}
    if(active){rect??=active.node.getBoundingClientRect();[active.tx,active.ty]=cardCoordinates(event.clientX,event.clientY,rect);active.node.classList.add('is-pointed');}
    dirty=true;requestFrame();
  },{passive:true});
  section.addEventListener('pointerleave',reset);section.addEventListener('pointercancel',reset);
  addEventListener('scroll',()=>{rect=null;},{passive:true});addEventListener('resize',reset,{passive:true});
  motion.addEventListener('change',reset);fine.addEventListener('change',reset);
  onFrame(now=>{
    if(!dirty)return;
    const dt=last?Math.min(64,Math.max(0,now-last)):16;last=now;
    const ease=motion.matches||!fine.matches?1:1-Math.exp(-dt/95);
    groupX+=(targetX-groupX)*ease;groupY+=(targetY-groupY)*ease;
    content.style.setProperty('--info-x',groupX.toFixed(3)+'px');content.style.setProperty('--info-y',groupY.toFixed(3)+'px');
    let moving=Math.abs(targetX-groupX)+Math.abs(targetY-groupY)>.015;
    for(const card of cards){
      card.x+=(card.tx-card.x)*ease;card.y+=(card.ty-card.y)*ease;
      card.node.style.setProperty('--card-x',card.x.toFixed(4));card.node.style.setProperty('--card-y',card.y.toFixed(4));
      card.node.style.setProperty('--spot-x',((card.x+.5)*100).toFixed(2)+'%');card.node.style.setProperty('--spot-y',((card.y+.5)*100).toFixed(2)+'%');
      moving||=Math.abs(card.tx-card.x)+Math.abs(card.ty-card.y)>.001;
      if(!active||card!==active)card.node.classList.remove('is-pointed');
    }
    dirty=moving;if(!moving)last=0;
  },5);
}
if(typeof document!=='undefined')startInteraction();
