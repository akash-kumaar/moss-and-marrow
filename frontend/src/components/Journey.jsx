import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Pause, Play, Square } from 'lucide-react';

const chapters = [
  ['opening', 'A welcome'],
  ['assembly', 'Anatomy of a dish'],
  ['signatures', 'From the kitchen'],
  ['story', 'Our story'],
  ['locations', 'Find us'],
  ['gallery', 'At the table'],
  ['reservations', 'Join us'],
  ['final-table', 'The final table'],
];
const durations = { relaxed: 7200, balanced: 5200, swift: 3600 };
const scrollKeys = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

function activeChapter() {
  const anchor = window.scrollY + window.innerHeight * .38;
  const assembly = document.getElementById('assembly')?.getBoundingClientRect();
  if (assembly && assembly.top <= 4 && assembly.bottom >= window.innerHeight - 4) {
    return chapters.findIndex(([id]) => id === 'assembly');
  }
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  chapters.forEach(([id], index) => {
    const element = document.getElementById(id);
    if (!element) return;
    const nextDistance = Math.abs(element.getBoundingClientRect().top + window.scrollY - anchor);
    if (nextDistance < distance) { nearest = index; distance = nextDistance; }
  });
  return nearest;
}

export function JourneyController() {
  const controller = useRef(null);
  const playhead = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [speed, setSpeed] = useState('balanced');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setPlaying(false);
    };
    syncPreference();
    preference.addEventListener?.('change', syncPreference);
    return () => preference.removeEventListener?.('change', syncPreference);
  }, []);

  useEffect(() => {
    const update = () => { if (!playing) setChapter(activeChapter()); };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, [playing]);

  useEffect(() => {
    if (!playing) return undefined;
    const interrupt = event => {
      if (controller.current?.contains(event.target)) return;
      cancelAnimationFrame(playhead.current);
      setPlaying(false);
    };
    const interruptKey = event => {
      if (scrollKeys.has(event.key) && !controller.current?.contains(event.target)) interrupt(event);
    };
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchstart', interrupt, { passive: true });
    window.addEventListener('pointerdown', interrupt, { passive: true });
    window.addEventListener('keydown', interruptKey);
    return () => {
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('touchstart', interrupt);
      window.removeEventListener('pointerdown', interrupt);
      window.removeEventListener('keydown', interruptKey);
    };
  }, [playing]);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const id = chapters[chapter][0];
    const section = document.getElementById(id);
    if (!section) { setPlaying(false); return; }
    const top = section.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(0, section.offsetHeight - window.innerHeight);
    const targets = id === 'assembly'
      ? [0, .28, .56, .81, 1].map(part => top + distance * part)
      : [top - 80];
    const origin = window.scrollY;
    let index = Math.max(0, targets.findIndex(target => target >= origin - 4));
    if (id === 'assembly' && origin >= targets.at(-1) - 4) index = targets.length - 1;
    let start = origin;
    let started = null;
    const delay = durations[speed] / (targets.length > 1 ? 3 : 1);
    const advance = now => {
      started ??= now;
      const elapsed = now - started;
      const travel = Math.min(1, elapsed / Math.min(1050, delay * .65));
      const target = Math.min(document.documentElement.scrollHeight - innerHeight, targets[index]);
      window.scrollTo({top: start + (target - start) * (1 - (1 - travel) ** 3), behavior: 'instant'});
      if (elapsed >= delay) {
        index++;
        if (index >= targets.length) {
          if (chapter === chapters.length - 1) setPlaying(false);
          else setChapter(chapter + 1);
          return;
        }
        start = window.scrollY;
        started = now;
      }
      playhead.current = requestAnimationFrame(advance);
    };
    playhead.current = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(playhead.current);
  }, [playing, chapter, speed, reducedMotion]);

  const go = index => {
    const next = Math.max(0, Math.min(chapters.length - 1, index));
    setPlaying(false);
    setChapter(next);
    document.getElementById(chapters[next][0])?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  };
  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    if (reducedMotion) return;
    if (chapter >= chapters.length - 1) go(0);
    setPlaying(true);
  };

  if (!expanded) return <button type="button" className="journey-launch" onClick={() => setExpanded(true)}>Cinematic Journey</button>;
  return <aside ref={controller} className="journey" aria-label="Cinematic Journey controls">
    <div className="journey-topline"><span>Explore automatically</span><span className="journey-progress-text">{String(chapter + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}</span></div>
    <div className="journey-chapter" aria-live="polite">{chapters[chapter][1]}</div>
    <div className="journey-progress" role="progressbar" aria-label="Journey progress" aria-valuemin="1" aria-valuemax={chapters.length} aria-valuenow={chapter + 1}>
      <span style={{ width: `${((chapter + 1) / chapters.length) * 100}%` }} />
    </div>
    <div className="journey-controls">
      <button type="button" aria-label="Previous chapter" onClick={() => go(chapter - 1)} disabled={chapter === 0}><ArrowUp size={16} /></button>
      <button type="button" className="journey-play" aria-label={playing ? 'Pause cinematic journey' : 'Play cinematic journey'} aria-pressed={playing} disabled={reducedMotion} onClick={toggle}>
        {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" aria-label="Next chapter" onClick={() => go(chapter + 1)} disabled={chapter === chapters.length - 1}><ArrowDown size={16} /></button>
      <label className="journey-speed"><span>Speed</span><select aria-label="Journey speed" value={speed} onChange={event => setSpeed(event.target.value)}>
        <option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="swift">Swift</option>
      </select></label>
      <button type="button" aria-label="Stop cinematic journey" onClick={() => { setPlaying(false); setExpanded(false); }}><Square size={14} /></button>
    </div>
    {reducedMotion && <p className="journey-note" role="status">Automatic motion is off due to your motion preference. Use chapter controls to move manually.</p>}
  </aside>;
}
