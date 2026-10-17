import Lenis from './lenis.mjs';
import { onFrame, requestFrame } from './frame.js';

export function cameraForScroll(scrollY, viewportHeight) {
  return Math.max(0, scrollY) / Math.max(1, viewportHeight);
}
export function infoInView(scrollY, infoTop, viewportHeight) {
  return scrollY + viewportHeight * .55 >= infoTop;
}
export function sectionEase(t) {
  t = Math.max(0,Math.min(1,t));
  return t ** 4 * (35 + t * (-84 + t * (70 - 20*t)));
}
export function sectionDuration(distance, viewportHeight) {
  return Math.min(.85,.40 + Math.sqrt(Math.abs(distance) / Math.max(1,viewportHeight)) * .22);
}
export function smoothWheel(event) {
  if (event.type !== 'wheel' || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  if (Math.abs(event.deltaX || 0) > Math.abs(event.deltaY)) return false;
  return event.deltaMode !== 0 || (Number.isInteger(event.deltaY) && Math.abs(event.deltaY) >= 40 && Math.abs(event.deltaX || 0) < 1);
}
function startScroll() {
  const viewport = document.querySelector('.universe');
  const page = document.querySelector('.page');
  const info = document.getElementById('info');
  const toggle = document.getElementById('info-toggle');
  const index = document.getElementById('section-index');
  const nav = document.getElementById('section-nav');
  const label = document.getElementById('current-section');
  const chapters = [...document.querySelectorAll('[data-section-link]')].map(link => ({
    link, target: document.getElementById(link.getAttribute('href').slice(1)),
    label: link.dataset.label, top: 0
  })).filter(chapter => chapter.target);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let lenis, showingInfo = null, lastY = -1, height = 1, infoTop = 0;
  let current = null, indexOpen = false, labelAnimation, indexAnimation;
  function updateToggleLabel() {
    toggle.setAttribute('aria-label',`${current?.label || 'TOP'} · 목차 ${indexOpen ? '닫기' : '열기'}`);
  }
  function setIndex(open, focus = false) {
    indexOpen = open; index.hidden = !open;
    toggle.setAttribute('aria-expanded',String(open)); updateToggleLabel();
    indexAnimation?.cancel();
    if (open && !motion.matches) indexAnimation = index.animate?.([
      {opacity:0,transform:'translateY(-6px) scale(.98)'},
      {opacity:1,transform:'translateY(0) scale(1)'}
    ],{duration:230,easing:'cubic-bezier(.22,1,.36,1)'});
    if (focus) (open ? chapters[0]?.link : toggle)?.focus({preventScroll:true});
  }
  function sync(force = false) {
    const y = Math.max(0,window.scrollY);
    if (!force && y === lastY) return;
    lastY = y;
    const camera = cameraForScroll(y,height);
    // Limit the inherited style update to the three background elements.
    viewport.style.setProperty('--scroll-y', y + 'px');
    dispatchEvent(new CustomEvent('portfolio-camerachange',{detail:{camera,scrollY:y,height}}));
    const chapter = chapters.filter(chapter => y + height * .55 >= chapter.top).at(-1) || chapters[0];
    if (chapter && chapter !== current) {
      const initial = !current; current = chapter; label.textContent = chapter.label;
      chapters.forEach(item => {
        if (item === chapter) item.link.setAttribute('aria-current','location');
        else item.link.removeAttribute('aria-current');
      });
      updateToggleLabel(); labelAnimation?.cancel();
      if (!initial && !motion.matches) labelAnimation = label.animate?.([
        {opacity:.3,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}
      ],{duration:180,easing:'ease-out'});
    }
    const visible = infoInView(y,infoTop,height);
    if (visible !== showingInfo) {
      showingInfo = visible; page.dataset.view = visible ? 'info' : 'intro';
      dispatchEvent(new CustomEvent('portfolio-scenechange',{detail:{info:visible}}));
    }
  }
  function measure() {
    height = viewport.clientHeight || innerHeight;
    infoTop = info.getBoundingClientRect().top + window.scrollY;
    chapters.forEach(chapter => { chapter.top = chapter.target.getBoundingClientRect().top + window.scrollY; });
    sync(true); requestFrame();
  }
  function cancelMomentum() {
    if (lenis?.isScrolling === 'smooth') lenis.scrollTo(window.scrollY,{immediate:true});
  }
  function resetToTop() {
    lenis?.stop();
    window.scrollTo({top:0,left:0,behavior:'auto'});
    lenis?.start();
    sync(true);requestFrame();
  }
  function configure() {
    lenis?.destroy(); lenis = null;
    if (!motion.matches) {
      try {
        lenis = new Lenis({
          autoRaf:false, lerp:.17, smoothWheel:true, syncTouch:false,
          respectReducedMotion:true, anchors:false,
          virtualScroll:({event}) => {
            if (document.documentElement.classList.contains('is-loading')) return false;
            const smooth = smoothWheel(event);
            if (!smooth) cancelMomentum();
            return smooth;
          }
        });
        lenis.on('scroll',() => sync());
      } catch { lenis = null; }
    }
    requestFrame();
  }
  function navigate(target) {
    const destination = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
    if (lenis) lenis.scrollTo(target,{duration:sectionDuration(destination-window.scrollY,height),lerp:0,easing:sectionEase});
    else if (typeof target === 'number') window.scrollTo({top:target,behavior:motion.matches?'auto':'smooth'});
    else target.scrollIntoView({behavior:motion.matches?'auto':'smooth',block:'start'});
    requestFrame();
  }
  toggle.addEventListener('click',() => setIndex(!indexOpen));
  toggle.addEventListener('keydown',event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(true,true); }
  });
  chapters.forEach(chapter => chapter.link.addEventListener('click',event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault(); setIndex(false,true);
    navigate(chapter.target.id === 'top' ? 0 : chapter.target);
  }));
  document.querySelectorAll('[data-open-info]').forEach(button=>button.addEventListener('click',()=>navigate(info)));
  // No extra RAF/easing between the actual scroll value and the camera.
  addEventListener('scroll',() => { sync(); requestFrame(); },{passive:true});
  addEventListener('resize',measure,{passive:true});
  addEventListener('pageshow',event => {
    measure();
    if (event.persisted || document.documentElement.classList.contains('is-loading')) resetToTop();
  });
  addEventListener('portfolio-reset-top',resetToTop);
  addEventListener('keydown',event => {
    if (event.key === 'Escape' && indexOpen) { event.preventDefault(); setIndex(false,true); }
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) cancelMomentum();
  });
  addEventListener('pointerdown',event => {
    cancelMomentum();
    if (indexOpen && !nav.contains(event.target)) setIndex(false);
  },{passive:true});
  document.addEventListener('focusin',event => {
    if (indexOpen && !nav.contains(event.target)) setIndex(false);
  });
  document.addEventListener('visibilitychange',() => { if (document.hidden) cancelMomentum(); });
  motion.addEventListener('change',configure);
  if (document.fonts) document.fonts.ready.then(measure);
  onFrame(now => { lenis?.raf(now); sync(); },-10);
  measure(); configure(); resetToTop();
}
if (typeof document !== 'undefined') startScroll();
