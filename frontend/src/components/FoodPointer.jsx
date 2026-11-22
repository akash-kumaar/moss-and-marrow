import React,{useEffect,useRef} from 'react';

export default function FoodPointer(){
  const node=useRef(null);
  useEffect(()=>{
    const query=matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
    const el=node.current;
    let frame=0,x=0,y=0,tx=0,ty=0;
    const draw=()=>{
      x+=(tx-x)*.23;
      y+=(ty-y)*.23;
      el.style.transform='translate3d('+x+'px,'+y+'px,0)';
      frame=Math.abs(tx-x)+Math.abs(ty-y)>.2?requestAnimationFrame(draw):0;
    };
    const move=e=>{
      if(!query.matches||e.pointerType!=='mouse')return;
      tx=e.clientX;ty=e.clientY;
      const target = e.target;
      if (target.closest('input, textarea, select, [contenteditable], dialog[open]')) {
        leave();
        return;
      }
      const control = target.closest('button, a, summary');
      const accessibleName = control?.getAttribute('aria-label') || '';
      let label = '';
      if (/^Add /i.test(accessibleName)) label = 'ADD';
      else if (/close/i.test(accessibleName)) label = 'CLOSE';
      else if (target.closest('.chapter-controls')) label = 'SLIDE';
      else if (target.closest('.bag-link')) label = 'BAG';
      else if (target.closest('.footer-toss')) label = 'TOSS';
      else if (target.closest('.gallery-tile,.signature-image,.shop-thumb') || /^View .* details/i.test(accessibleName)) label = 'VIEW';
      else if (target.closest('.build-plate')) label = 'EXPLORE';
      else if (control?.matches('a')) label = '↗';
      else if (control) label = '•';
      if (el.hidden) { x = tx; y = ty; }
      el.hidden = false;
      el.dataset.state = label.length > 1 ? 'label' : label ? 'action' : 'idle';
      el.dataset.label = label;
      el.textContent = label;
      document.documentElement.classList.add('food-cursor-active');
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const leave = () => {
      el.hidden = true;
      document.documentElement.classList.remove('food-cursor-active');
    };
    const burst=e=>{
      if(!query.matches||e.pointerType!=='mouse'||e.button!==0||!e.target.closest('.button,.gallery-tile,.shop-icon,.signature-item a'))return;
      const ring=document.createElement('i');
      ring.className='food-burst';
      ring.style.left=e.clientX+'px';
      ring.style.top=e.clientY+'px';
      el.parentElement.append(ring);
      ring.addEventListener('animationend',()=>ring.remove(),{once:true});
    };
    window.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('pointerdown',burst,{passive:true});
    document.documentElement.addEventListener('pointerleave',leave);
    query.addEventListener('change',leave);
    return ()=>{
      cancelAnimationFrame(frame);
      leave();
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerdown',burst);
      document.documentElement.removeEventListener('pointerleave',leave);
      query.removeEventListener('change',leave);
      el.parentElement?.querySelectorAll('.food-burst').forEach(ring=>ring.remove());
    };
  },[]);
  return <div className="food-effects" aria-hidden="true"><span className="food-pointer" ref={node} hidden/></div>;
}
