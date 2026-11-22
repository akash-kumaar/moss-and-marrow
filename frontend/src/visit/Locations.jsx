import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock, MapPin } from 'lucide-react';
import { branches, findBranch } from './branches.js';
import { Photo } from '../components/Photo.jsx';
import { Reveal } from '../components/Motion.jsx';

function BranchImage({ branch }) {
  return (
    <figure className="visit-image">
      <Photo key={branch.image} src={branch.image} alt={branch.imageAlt}
        sizes="(max-width: 800px) 90vw, 56vw" width="1000" height="740" />
      <figcaption>{branch.imageCaption || 'Illustrative café photography'}</figcaption>
    </figure>
  );
}

export function BranchSection({ standalone = false }) {
  const [selected, setSelected] = useState(branches[0]?.slug || '');
  const branch = findBranch(selected);
  const Heading = standalone ? 'h1' : 'h2';
  return (
    <section id="locations" className="visit-discover" aria-labelledby="visit-discover-title">
      <Reveal className="wrap">
        <p className="eyebrow">Visit</p>
        <Heading id="visit-discover-title">Find your <em>Moss &amp; Marrow.</em></Heading>
        {branch ? <div className="visit-layout">
          <div className="visit-selector" aria-label="Choose a neighbourhood" role="group">
            {branches.map(location => (
              <button key={location.slug} type="button" aria-pressed={location === branch}
                aria-controls="branch-preview" onClick={() => setSelected(location.slug)}>
                <span>{location.name}<small>{location.area}</small></span>
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div id="branch-preview" className="visit-preview">
            <BranchImage branch={branch} />
            <div key={branch.slug} className="visit-preview-copy" aria-live="polite">
              <div><h3>{branch.name}</h3><p>{branch.copy}</p></div>
              <div><p className="visit-hours"><Clock size={15} aria-hidden="true" /> {branch.hours}</p>
                <Link className="visit-text-link" to={'/locations/' + branch.slug}>View branch details <ArrowUpRight size={17} /></Link>
              </div>
            </div>
          </div>
        </div> : <div className="visit-unlisted">
          <p>Verified branch details are not available yet. Tell us the area you have in mind and the team can help with your visit.</p>
          <div><Link className="button butter" to="/reservations">Request a table <ArrowRight size={16} /></Link>
            <Link className="visit-text-link" to="/contact">Ask about a location <ArrowUpRight size={16} /></Link></div>
        </div>}
      </Reveal>
    </section>
  );
}

export function LocationsPage() {
  return <main><BranchSection standalone /></main>;
}

export function BranchPage() {
  const { slug } = useParams();
  const branch = findBranch(slug);
  if (!branch) return (
    <main className="visit-detail wrap">
      <h1>Location unavailable</h1>
      <Link className="visit-text-link" to="/locations"><ArrowLeft size={17} /> All locations</Link>
    </main>
  );
  const query = '?branch=' + branch.slug;
  return (
    <main className="visit-detail wrap">
      <Link className="visit-text-link" to="/locations"><ArrowLeft size={17} /> All locations</Link>
      <div className="visit-detail-grid">
        <div>
          <p className="eyebrow">Moss &amp; Marrow · Bengaluru</p>
          <h1>{branch.name}</h1>
          <p className="visit-lede">{branch.copy}</p>
          <dl className="visit-facts">
            <div><dt>Location</dt><dd>{branch.address || (branch.area + ', ' + branch.name + ', Bengaluru')}</dd></div>
            <div><dt>Opening hours</dt><dd>{branch.hours}</dd></div>
            <div><dt>Services</dt><dd>Dining room · Table reservations</dd></div>
            {branch.phone && <div><dt>Telephone</dt><dd><a href={'tel:' + branch.phone}>{branch.phone}</a></dd></div>}
            {branch.email && <div><dt>Email</dt><dd><a href={'mailto:' + branch.email}>{branch.email}</a></dd></div>}
          </dl>
          <div className="visit-actions">
            <Link className="button" to={'/reservations' + query}>Book a table <ArrowRight size={16} /></Link>
            <Link className="visit-text-link" to={'/menu' + query}>Explore the menu <ArrowUpRight size={16} /></Link>
          </div>
          {branch.directionsUrl && <a className="visit-text-link" href={branch.directionsUrl}><MapPin size={16} /> Get directions</a>}
        </div>
        <BranchImage branch={branch} />
      </div>
    </main>
  );
}
