import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Expand, X } from 'lucide-react';
import { Photo, scenes } from '../components/Photo';
import { Reveal } from '../components/Motion';

const gallery = [
  {
    ...scenes.brunch,
    fullSrc: '/images/editorial/brioche-french-toast-gallery-3840.webp',
    title: 'Brioche French toast',
    group: 'Kitchen',
  },
  { src: '/images/menu/brunch/avocado-feta-sourdough-toast.webp', fullSrc: '/images/menu/brunch/avocado-feta-sourdough-toast.webp', title: 'Avocado & feta sourdough', alt: 'Fanned avocado and crumbled feta on toasted sourdough', group: 'Kitchen' },
  { src: '/images/menu/coffee/double-espresso.webp', title: 'The double espresso', alt: 'Dark espresso with crema in a white demitasse', group: 'CafÃ©' },
  { src: '/images/menu/mains/penne-arrabbiata.webp', title: 'Penne arrabbiata', alt: 'Ridged penne with tomato, chilli and fresh basil', group: 'Kitchen' },
  { src: '/images/menu/brunch/butter-croissant.webp', title: 'Butter croissant', alt: 'A single flaky croissant on an ivory plate', group: 'CafÃ©' },
  { src: '/images/menu/desserts/classic-tiramisu.webp', title: 'Classic tiramisu', alt: 'Layered mascarpone, coffee-soaked sponge and cocoa', group: 'Kitchen' }
];

function Lightbox({ photos, index, setIndex, close }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const move = step => setIndex(i => (i + step + photos.length) % photos.length);
  const current = photos[index];
  return <dialog ref={ref} className="lightbox" aria-label="Gallery viewer" onCancel={close}
    onClick={e => { if (e.target === ref.current) close(); }}
    onKeyDown={e => {
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
    }}>
    <div className="viewer">
      <button autoFocus className="viewer-close" onClick={close} aria-label="Close gallery"><X/></button>
      <Photo key={current.src} src={current.fullSrc ?? current.src} srcSet={current.fullSrc ? '' : undefined} alt={current.alt} className="viewer-image" priority/>
      <div className="viewer-controls"><span aria-live="polite">{current.title} <small>{index + 1} / {photos.length}</small></span>
        {photos.length > 1 && <><button aria-label="Previous image" onClick={() => move(-1)}><ArrowLeft/></button>
        <button aria-label="Next image" onClick={() => move(1)}><ArrowRight/></button></>}
      </div>
    </div>
  </dialog>;
}

export function Gallery({ preview = false }) {
  const [category, setCategory] = useState('All');
  const [index, setIndex] = useState(null);
  const photos = preview ? gallery.slice(0,3) : gallery.filter(p => category === 'All' || p.group === category);
  const Heading = preview ? 'h2' : 'h1';
  return <section id={preview ? 'gallery' : undefined} className={'gallery-section wrap block ' + (preview ? 'gallery-preview' : '')}>
    <Reveal className="section-heading"><div><p className="eyebrow ruled">The gallery</p><Heading>A little <i>atmosphere.</i></Heading></div>
      {preview && <Link className="arrow-link" to="/gallery">Open gallery <ArrowUpRight size={16}/></Link>}</Reveal>
    {!preview && <div aria-label="Gallery categories" className="gallery-filters">{['All','Kitchen','CafÃ©'].map(group =>
      <button aria-pressed={category === group} key={group} onClick={() => setCategory(group)}>{group}</button>)}</div>}
    <div className="gallery-wall gallery-horizontal">{photos.map((photo, i) => <button key={photo.src} className="gallery-tile" onClick={() => setIndex(i)} aria-label={'Enlarge ' + photo.title}>
      <Photo src={photo.src} alt={photo.alt} sizes="(max-width: 700px) 82vw, 43vw"/>
      <span>{photo.title}<Expand size={17}/></span></button>)}</div>
    {index !== null && <Lightbox photos={photos} index={index} setIndex={setIndex} close={() => setIndex(null)}/>}
  </section>;
}
