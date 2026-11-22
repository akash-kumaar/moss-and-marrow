import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, MapPin, Pause, Play } from 'lucide-react';
import { Magnetic, Reveal, SplitText } from '../components/Motion';
import { Assembly, Ticker } from './FoodWorld';
import { JourneyController } from '../components/Journey';
import { Photo, scenes } from '../components/Photo';
import { BranchSection, branches } from '../visit/index.jsx';
import { Gallery } from './Gallery';

const heroBrunch = {
  ...scenes.brunch,
  src: '/images/editorial/french-toast-hero-1086.webp',
  srcSet: [640, 1086, 1600, 2880].map(width => '/images/editorial/french-toast-hero-' + width + '.webp ' + width + 'w').join(', '),
  sizes: '(max-width: 800px) 100vw, 54vw',
};
function heroPortrait(scene, name, largestWidth) {
  const path = '/images/editorial/' + name + '-photo-';
  return {
    ...scene,
    src: path + '1120.webp',
    srcSet: [640, 1120, 1600, largestWidth].map(width => path + width + '.webp ' + width + 'w').join(', '),
    sizes: heroBrunch.sizes,
  };
}
const chapters = [heroBrunch, heroPortrait(scenes.table, 'kitchen', 2160), heroPortrait(scenes.coffee, 'cafe', 2880)];
function Hero() {
  const [chapter, setChapter] = useState(0);
  const media = useRef(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(preference.matches);
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setChapter(index => (index + 1) % chapters.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [chapter, paused, reduced]);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: no-preference) and (min-width: 850px)');
    let frame = 0;
    const update = () => {
      frame = 0;
      if (media.current) media.current.style.setProperty('--shift', (query.matches ? Math.min(62, window.scrollY * .13) : 0) + 'px');
    };
    const scroll = () => { if (!frame && (window.scrollY < 1050 || !query.matches)) frame = requestAnimationFrame(update); };
    query.addEventListener('change', update);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => { cancelAnimationFrame(frame); query.removeEventListener('change', update); window.removeEventListener('scroll', scroll); };
  }, []);
  const scene = chapters[chapter];
  return <section id="opening" className="cinema" aria-label="Welcome to Moss and Marrow">
    <div className="cinema-media" ref={media}><Photo key={scene.src} {...scene} sizes={scene.sizes ?? "(max-width: 800px) 100vw, 54vw"} priority/></div>
    <div className="cinema-shade"/>
    <div className="wrap cinema-content">
      <p className="eyebrow hero-kicker"><span/> Café · Kitchen · Bar</p>
      <h1 className="hero-split"><SplitText as="span">MOSS &</SplitText><SplitText as="i">MARROW.</SplitText></h1>
      <p className="cinema-intro">Coffee, brunch, and a kitchen menu made for taking your time.</p>
      <div className="cinema-actions"><Magnetic><Link className="button butter" to="/menu">Explore the menu <ArrowUpRight size={16}/></Link></Magnetic>
        <Magnetic><Link className="hero-text-link" to="/reservations">Reserve a table <ArrowRight size={16}/></Link></Magnetic></div>
    </div>
    <div className="wrap cinema-foot">
      <a href="#signatures" className="scroll-link"><ArrowDown size={15}/> From the kitchen</a>
      <div className="chapter-controls"><span aria-live={paused || reduced ? "polite" : "off"}>{scene.label}</span>
        <button aria-label="Previous scene" onClick={() => setChapter((chapter + 2) % 3)}><ChevronLeft size={17}/></button>
        {!reduced && <button type="button" aria-label={paused ? "Play automatic slides" : "Pause automatic slides"} onClick={() => setPaused(value => !value)}>{paused ? <Play size={15}/> : <Pause size={15}/>}</button>}
        <button aria-label="Next scene" onClick={() => setChapter((chapter + 1) % 3)}><ChevronRight size={17}/></button></div>
    </div>
  </section>;
}

function Signature({ items }) {
  const preferred = ['penne-arrabbiata','butter-croissant','spanish-latte'];
  const featured = [...new Set([...preferred.map(s => items.find(item => item.slug === s)).filter(Boolean), ...items.filter(item => item.isFeatured), ...items])].slice(0,3);
  return <section id="signatures" className="wrap block signatures">
    <Reveal className="section-heading"><div><p className="eyebrow ruled">From our kitchen</p><h2>House <i>signatures.</i></h2></div>
      <Link to="/menu" className="arrow-link">View the full menu <ArrowUpRight size={16}/></Link></Reveal>
    {featured.length ? <div className="signature-list">{featured.map((dish, i) =>
      <Reveal key={dish.slug} className="signature-item" style={{'--delay':i * 70 + 'ms'}}>
        <Link to={'/menu?dish=' + encodeURIComponent(dish.slug)}><div className="signature-image"><Photo src={dish.image} alt={dish.name} sizes="(max-width: 650px) 90vw, 32vw"/><span aria-hidden="true"><ArrowUpRight size={20}/></span></div>
          <div className="signature-meta"><small>{dish.category}</small><span>₹{dish.price}</span></div><h3>{dish.name}</h3></Link>
        <p>{dish.description}</p>
      </Reveal>)}</div> : <p>The kitchen is updating the menu.</p>}
  </section>;
}

export function StorySection({ page = false }) {
  const Heading = page ? 'h1' : 'h2';
  return <section id={page ? undefined : 'story'} className={'story-panel ' + (page ? 'story-page':'')}><div className="wrap story-layout">
    <figure className="story-frame"><Photo src="/images/editorial/our-story-1122.webp"
      srcSet="/images/editorial/our-story-640.webp 640w, /images/editorial/our-story-1122.webp 1122w, /images/editorial/our-story-3072.webp 3072w"
      alt="Frothy filter kaapi poured from a steel tumbler beside a butter croissant" priority={page} sizes="(max-width: 750px) 90vw, 48vw"/></figure>
    <Reveal className="story-copy"><p className="eyebrow ruled">Our story</p><Heading>First, <i>kaapi.</i><br/>Then, stay awhile.</Heading>
      <p>In Bengaluru, the clink of a steel tumbler is part of the morning. At Moss &amp; Marrow, there’s room beside the filter kaapi for a butter croissant, crumbs and all.</p>
      {page && <><p>As the morning stretches into lunch, there’s charred sourdough with avocado, feta and lemon, or penne arrabbiata with enough chilli to wake up the table.</p>
      <p>And if lunch runs long? Split the tiramisu. Or order another coffee and keep your spoon.</p></>}
      <Link className="arrow-link" to={page ? '/menu' : '/story'}>{page ? 'Explore the menu' : 'Read our story'}<ArrowUpRight size={16}/></Link>
    </Reveal></div></section>;
}

export function BookingCTA() {
  return <section id="reservations" className="booking-cta"><Reveal className="wrap booking-inner">
    <div><p className="eyebrow ruled">Reservations</p><h2>Join us <i>at the table.</i></h2></div>
    <Link className="button butter" to="/reservations">Find a table <ArrowUpRight size={16}/></Link>
  </Reveal></section>;
}

export default function Home({ catalog }) {
  return <><Hero/><div className="local-strip"><div className="wrap"><span><MapPin size={15}/> Planning a visit</span>
    <div>{branches.length ? branches.map(b => <Link key={b.slug} to={'/locations/' + b.slug}>{b.name}<ArrowUpRight size={13}/></Link>) : <>
      <Link to="/locations">Location information<ArrowUpRight size={13}/></Link><Link to="/reservations">Reservations<ArrowUpRight size={13}/></Link>
    </>}</div></div></div>
    <Ticker>BREAKFAST TO THE LAST BITE</Ticker><section className="wrap block definition"><p className="eyebrow">The Moss &amp; Marrow dictionary</p><h2>Marrow.</h2><p><i>noun.</i> The good stuff at the centre. Also, a good reason to stay for tiramisu.</p></section><Assembly/><section className="plated-story"><Photo src="/images/menu/brunch/avocado-feta-sourdough-toast.webp" alt="Avocado and feta on toasted sourdough" sizes="(max-width:700px) 100vw, 55vw"/><div><p className="eyebrow">On the plate</p><h2>Avocado &amp; feta sourdough.</h2><Link className="arrow-link" to="/menu?dish=avocado-feta-sourdough-toast">View dish details</Link></div></section><Signature items={catalog.items}/><Ticker reverse>ESPRESSO · PASTA · TIRAMISU</Ticker><StorySection/><BranchSection/><Gallery preview/><section className="wrap block visit-sequence"><h2>Plan your table.</h2><ol><li><Link to="/menu">Browse the menu</Link></li><li><Link to="/checkout">Save your choices in your bag</Link></li><li>Order with the team at the restaurant</li></ol></section><BookingCTA/><JourneyController/></>;
}
