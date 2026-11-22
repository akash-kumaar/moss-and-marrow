import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, ShoppingBag, X } from 'lucide-react';
import { branches } from '../visit/index.jsx';

const links = [['Menu', '/menu'], ['Our story', '/story'], ['Locations', '/locations'], ['Gallery', '/gallery']];

export function Header({ count, openBag }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggle = useRef(null);
  const { pathname, search } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname, search]);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = e => {
      if (e.key === 'Escape') { setOpen(false); toggle.current?.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = previousOverflow; };
  }, [open]);
  return <header className={'masthead' + (scrolled ? ' masthead-scrolled' : '')} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <div className="mast-inner">
      <Link className="wordmark" to="/" aria-label="Moss and Marrow home">Moss <i>&amp;</i> Marrow<span>CAFÉ · KITCHEN · BAR</span></Link>
      <nav aria-label="Main navigation" className="desktop-nav">{links.map(([name,url]) => <NavLink key={url} to={url}>{name}</NavLink>)}</nav>
      <div className="mast-actions">
        <button type="button" onClick={openBag} aria-haspopup="dialog" aria-label={'View bag, ' + count + ' items'} className="bag-link"><ShoppingBag size={18}/>{count > 0 && <span>{count}</span>}</button>
        <Link className="nav-book" to="/reservations">Book a table <ArrowUpRight size={15}/></Link>
        <button className="nav-toggle icon-button" ref={toggle} onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-navigation">{open ? <X/> : <Menu/>}</button>
      </div>
    </div>
    {open && <nav id="mobile-navigation" aria-label="Mobile navigation">{[...links, ['Reservations','/reservations'],['Contact','/contact']].map(([name,url]) => <NavLink key={url} to={url} onClick={() => setOpen(false)}>{name}<ArrowUpRight size={16}/></NavLink>)}</nav>}
  </header>;
}

export function Footer() {
  const [toss, setToss] = useState(0);
  return <footer id="final-table" className="site-footer"><div className="footer-play" onPointerMove={e => { if(e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return; const box=e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--food-shift", ((e.clientX-box.left)/box.width-.5)*28+"px"); }} onPointerLeave={e => e.currentTarget.style.removeProperty("--food-shift")}><p>Give the table a little shake.</p><div className="footer-display">Moss <i>&amp;</i> Marrow</div><button type="button" className="footer-toss" onClick={() => setToss(n => n + 1)}>Toss the ingredients</button><div key={toss} className={toss ? "footer-food tossed" : "footer-food"} aria-hidden="true"><i/><i/><i/></div></div><div className="wrap foot-grid">
    <Link className="foot-logo" to="/" aria-label="Moss and Marrow home"><img src="/images/brand/mark.webp" width="220" height="165" alt="Moss & Marrow · Café, Kitchen, Bar" loading="lazy"/></Link>
    <div><h2>At the restaurant</h2>{links.map(([name,url]) => <Link key={url} to={url}>{name}</Link>)}<Link to="/locations">Locations</Link></div>
    <div><h2>Visit us</h2>{branches.map(b => <Link key={b.slug} to={'/locations/' + b.slug}>{b.name}<small>{b.hours}</small></Link>)}</div>
    <div><h2>Plan a visit</h2><Link to="/reservations">Reserve a table</Link><Link to="/private-dining">Private dining</Link><Link to="/contact">Get in touch</Link></div>
  </div><div className="wrap foot-base"><span>© {new Date().getFullYear()} Moss &amp; Marrow</span><span>Café · Kitchen · Bar</span></div></footer>;
}
