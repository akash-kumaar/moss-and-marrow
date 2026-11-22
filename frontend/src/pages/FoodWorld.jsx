import React, {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';

const stages = [
  ['Sourdough','Charred sourdough gives the toast its crisp base.'],
  ['Avocado','Slices of avocado soften each bite.'],
  ['Feta','Crumbled feta brings a salty edge.'],
  ['Lemon','A finish of lemon lifts the plate.'],
];
export function Assembly(){
  const section=useRef(null);
  const [step,setStep]=useState(0);
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0;
    const update=()=>{
      frame=0;
      const el=section.current;
      if(!el)return;
      const bounds=el.getBoundingClientRect();
      const p=Math.min(1,Math.max(0,-bounds.top/Math.max(1,bounds.height-innerHeight)));
      el.style.setProperty('--build',reduced.matches?1:p);
      setStep(reduced.matches?3:Math.min(3,Math.floor(p*4)));
    };
    const queue=()=>{if(!frame)frame=requestAnimationFrame(update)};
    update();
    addEventListener('scroll',queue,{passive:true});
    addEventListener('resize',queue);
    reduced.addEventListener('change',queue);
    return ()=>{cancelAnimationFrame(frame);removeEventListener('scroll',queue);removeEventListener('resize',queue);reduced.removeEventListener('change',queue)};
  },[]);
  return <section id="assembly" ref={section} className="food-build" aria-labelledby="build-title">
    <div className="build-stage">
      <div className="build-copy"><p className="eyebrow">Anatomy of a dish</p><h2 id="build-title">Toast, built<br/>from scratch.</h2>
      <progress aria-label="Ingredient stage" max={4} value={step+1}/><h3>{stages[step][0]}</h3><p>{stages[step][1]}</p>
      <Link className="arrow-link" to="/menu?dish=avocado-feta-sourdough-toast">See the dish ↗</Link></div>
      <div className="build-plate" aria-hidden="true">
        <div className="ingredient bread"/>
        <div className="ingredient avocado">{Array.from({length:6},(_,i)=><i key={i}/>)}</div>
        <div className="ingredient feta">{Array.from({length:12},(_,i)=><i key={i} style={{left:(i*37)%89+'%',top:(i*23)%76+'%'}}/>)}</div>
        <div className="ingredient lemon"/>
      </div>
    </div>
  </section>
}
export function Ticker({children,reverse=false}){
  return <div className={'food-ticker'+(reverse?' backward':'')} aria-hidden="true"><div>{[0,1].map(n=><span key={n}>{Array.from({length:4},(_,i)=><b key={i}>{children} ✳ </b>)}</span>)}</div></div>
}
