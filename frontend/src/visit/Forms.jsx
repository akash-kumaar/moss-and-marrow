import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { branches, findBranch } from './branches.js';

const api = import.meta.env.VITE_API_URL || '/api/v1';
const seatings = ['12:30 PM', '1:30 PM', '7:30 PM', '8:30 PM'];
const localDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function BranchField({ required }) {
  const [params] = useSearchParams();
  if (branches.length === 0) return <label>Preferred location
    <input name="branch" type="text" autoComplete="address-level2" minLength="2" maxLength="100" required={required}
      defaultValue={params.get('branch') || ''} placeholder="Enter an area or neighbourhood" />
  </label>;
  return <label>Location
    <select name="branch" required={required} defaultValue={findBranch(params.get('branch'))?.slug || ''}>
      <option value="">{required ? 'Choose a location' : 'Any location'}</option>
      {branches.map(branch => <option key={branch.slug} value={branch.slug}>{branch.name}</option>)}
    </select>
  </label>;
}

function GuestFields() {
  return <>
    <label>Your name<input name="name" type="text" autoComplete="name" minLength="2" maxLength="100" required /></label>
    <label>Email address<input name="email" type="email" autoComplete="email" maxLength="254" required /></label>
  </>;
}

function FormPage({ children, title, description, group, link }) {
  return (
    <main className="visit-form-page">
      <div className="wrap visit-form-layout">
        <div className="visit-form-intro">
          <p className="eyebrow">{group}</p>
          <h1>{title}</h1>
          <p className="visit-lede">{description}</p>
          {link}
        </div>
        {children}
      </div>
    </main>
  );
}

function SubmitForm({ endpoint, payloadFrom, action, children, success }) {
  const [phase, setPhase] = useState('editing');
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  const inFlight = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = payloadFrom(values);
    inFlight.current = true;
    setPhase('sending');
    setError('');
    try {
      const response = await fetch(api + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || 'The restaurant service is unavailable. Please try again.');
      if (!result?.data?.reference) throw new Error('The service could not confirm your submission. Please contact the restaurant before trying again.');
      setRecord({ ...payload, ...result.data });
      setPhase('done');
    } catch (failure) {
      setError(failure instanceof TypeError ? 'We couldn’t reach the restaurant. Check your connection and try again.' : failure.message);
      setPhase('editing');
    } finally {
      inFlight.current = false;
    }
  }
  if (phase === 'done') return (
    <section className="visit-form visit-receipt" role="status">
      <Check size={30} aria-hidden="true" />
      {success(record)}
      <p>Reference <strong>{record.reference}</strong></p>
      <Link className="visit-text-link" to="/menu">Explore the menu <ArrowRight size={16} /></Link>
    </section>
  );
  return <form className="visit-form" onSubmit={submit} aria-busy={phase === 'sending'}>
    {children}
    {error && <p className="visit-error" role="alert">{error}</p>}
    <button type="submit" className="button" disabled={phase === 'sending'}>
      {phase === 'sending' ? 'Sending…' : action} <ArrowRight size={17} />
    </button>
  </form>;
}

export function ReservationPage() {
  return <FormPage group="Reservations" title={<>Join us <em>at the table.</em></>}
    description={branches.length ? 'Choose a dining room, a date and a seating to request your table.' : 'Tell us the area you have in mind, then choose a date and seating. The team can confirm the location details.'}
    link={<Link className="visit-text-link" to="/private-dining">Gathering with more than eight? <ArrowRight size={16} /></Link>}>
    <SubmitForm endpoint="/reservations" action="Request a table"
      payloadFrom={({ branch, date, time, guests, name, email }) => ({
        branch, date, time, guests: Number(guests), customer: { name, email },
      })}
      success={record => <>
        <h2>Table request received</h2>
        <p>{findBranch(record.branch)?.name || record.branch} · {new Intl.DateTimeFormat('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        }).format(new Date(record.date))} · {record.time} · {record.guests} {record.guests === 1 ? 'guest' : 'guests'}</p>
        <p>Status: {record.status || 'pending'}.</p>
      </>}>
      <BranchField required />
      <div className="visit-field-pair">
        <label>Date<input name="date" type="date" min={localDate()} required /></label>
        <label>Party size<select name="guests" defaultValue="2">{Array.from({ length: 8 }, (_, i) =>
          <option key={i} value={i + 1}>{i + 1} {i ? 'guests' : 'guest'}</option>)}</select></label>
      </div>
      <label>Seating time<select required name="time" defaultValue="">
        <option value="">Select a time</option>{seatings.map(time => <option key={time}>{time}</option>)}
      </select></label>
      <GuestFields />
    </SubmitForm>
  </FormPage>;
}

function EnquiryPage({ privateDining }) {
  const purpose = privateDining ? 'private-dining' : 'general';
  return <FormPage group={privateDining ? 'Private dining' : 'Contact'}
    title={privateDining ? <>A table for <em>your gathering.</em></> : <>Get in <em>touch.</em></>}
    description={privateDining ? 'Tell us about your group, preferred date and dining room.' : 'Send a question to the team about a visit, a menu item or a special occasion.'}
    link={<Link className="visit-text-link" to="/reservations">Looking for a table? <ArrowRight size={16} /></Link>}>
    <SubmitForm endpoint="/enquiries" action="Send enquiry"
      payloadFrom={({ branch, name, email, message }) => ({ type: purpose, branch: branch || undefined, name, email, message })}
      success={() => <><h2>Enquiry received</h2><p>Your message has been saved for the restaurant team.</p></>}>
      <GuestFields /><BranchField />
      <label>Your message<textarea name="message" rows="4" minLength="5" maxLength="2000" required /></label>
    </SubmitForm>
  </FormPage>;
}

export function ContactPage() { return <EnquiryPage key="general" />; }
export function PrivateDiningPage() { return <EnquiryPage key="private" privateDining />; }
