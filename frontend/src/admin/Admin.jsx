import React, { useEffect, useState } from 'react';
import { branches } from '../visit/branches';
import { LayoutDashboard, CalendarDays, Users, MapPin, Inbox, UtensilsCrossed, ShieldCheck } from 'lucide-react';
import './admin.css';

const base = '/api/v1/admin';
const sectionIcons = {Overview:LayoutDashboard,Reservations:CalendarDays,Customers:Users,Branches:MapPin,Enquiries:Inbox,Menu:UtensilsCrossed,Integrity:ShieldCheck};
const sections = ['Overview','Reservations','Customers','Branches','Enquiries','Menu','Integrity'];
async function request(path, options = {}) {
  const response = await fetch(base + path, {credentials:'same-origin',...options});
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message || 'Request failed.'),{status:response.status,retryAfter:Number(response.headers.get("Retry-After"))||0});
  return body.data;
}
const date = value => value ? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(value)) : '—';

function Distribution({title,rows = [],field = 'count'}) {
  const max = Math.max(1,...rows.map(row=>row[field]));
  return <section className="admin-chart"><h2>{title}</h2>{rows.length ? rows.map(row=><div key={row._id}><span>{row._id || 'Unspecified'}</span><meter min="0" max={max} value={row[field]}/><b>{row[field]}</b></div>):<p>No matching activity.</p>}</section>;
}
export default function Admin() {
  const [session,setSession]=useState(undefined);
  const [showPassword,setShowPassword]=useState(false);
  const [lockUntil,setLockUntil]=useState(0);
  const [secondsLeft,setSecondsLeft]=useState(0);
  useEffect(()=>{if(!lockUntil)return;const tick=()=>setSecondsLeft(Math.max(0,Math.ceil((lockUntil-Date.now())/1000)));tick();const timer=setInterval(tick,250);return ()=>clearInterval(timer);},[lockUntil]);
  const [section,setSection]=useState('Overview');
  const [q,setQuery]=useState('');
  const [branch,setBranch]=useState('');
  const [status,setStatus]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [page,setPage]=useState(1);
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState(null);
  const [refresh,setRefresh]=useState(0);
  const [collapsed,setCollapsed]=useState(false);
  const [notice,setNotice]=useState('');
  const params = new URLSearchParams({page:String(page),q,...branch&&{branch},...status&&{status},...from&&{from},...to&&{to}});
  const resource = section==='Branches'?'overview':section.toLowerCase();
  useEffect(()=>{request('/session').then(setSession).catch(e=>{setSession(null);if(e.status!==401)setError(e.message);});},[]);
  useEffect(()=>{
    if(!session)return;
    let active=true;
    setData(null);setError('');setSelected(null);
    request('/'+resource+'?'+params).then(result=>{if(active)setData(result);}).catch(e=>{if(active){setError(e.message);if([401,403].includes(e.status))setSession(null);}});
    return ()=>{active=false;};
  },[session,section,q,branch,status,from,to,page,refresh]);
  const headers={'Content-Type':'application/json','X-CSRF-Token':session?.csrf || ''};
  async function login(event) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const values=Object.fromEntries(new FormData(event.currentTarget));

      await request('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      setSession(await request('/session'));
    }catch(e){setError(e.message);if(e.retryAfter){setLockUntil(Date.now()+e.retryAfter*1000);setSecondsLeft(e.retryAfter);}}finally{setBusy(false);}
  }
  async function update(path,body) {
    if(!window.confirm('Save these changes?'))return;
    setBusy(true);setError('');
    try{await request(path,{method:'PATCH',headers,body:JSON.stringify(body)});setNotice('Changes saved.');setRefresh(n=>n+1);}catch(e){setError(e.message);if(e.retryAfter){setLockUntil(Date.now()+e.retryAfter*1000);setSecondsLeft(e.retryAfter);}}finally{setBusy(false);}
  }
  async function saveDish(event) {
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.currentTarget));

    const body={...values,price:Number(values.price),isAvailable:values.isAvailable==='on'};
    if(selected.slug)delete body.slug;
    if(!window.confirm('Save this dish to the public menu?'))return;
    setBusy(true);
    try {await request('/menu'+(selected.slug?'/'+selected.slug:''),{method:selected.slug?'PATCH':'POST',headers,body:JSON.stringify(body)});setNotice('Menu saved.');setRefresh(n=>n+1);}catch(e){setError(e.message);if(e.retryAfter){setLockUntil(Date.now()+e.retryAfter*1000);setSecondsLeft(e.retryAfter);}}finally{setBusy(false);}
  }
  async function exportRows() {
    setBusy(true);
    try {
      const response=await fetch(base+'/'+resource+(section==='Integrity'?'?export=csv&':'/export?')+params);
      if(!response.ok)throw new Error((await response.json()).message);
      const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=resource+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e.message);if(e.retryAfter){setLockUntil(Date.now()+e.retryAfter*1000);setSecondsLeft(e.retryAfter);}}finally{setBusy(false);}
  }
  if(session===undefined)return <main className="owner-login" aria-busy="true">Checking owner session…</main>;
  if(!session)return <main className="owner-login"><form onSubmit={login}><a href="/">Moss & Marrow</a><p>Owner access</p><h1>Welcome back.</h1><label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<span className="owner-password"><input name="password" type={showPassword?"text":"password"} autoComplete="current-password" required/><button type="button" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?"Hide":"Show"}</button></span></label>{error&&<p role="alert">{error}</p>}<button disabled={busy||secondsLeft>0}>{secondsLeft>0?`Try again in ${secondsLeft}s`:busy?"Signing in…":"Sign in"}</button></form></main>;
  const overview=section==='Overview'||section==='Branches';
  const items=data?.items || [];
  return <div className={'owner-app '+(collapsed?'owner-compact':'')}>
    <aside><a href="/">Moss & Marrow</a><button onClick={()=>setCollapsed(!collapsed)} aria-label="Toggle sidebar">☰</button><nav>{sections.map(name=><button key={name} aria-current={name===section?'page':undefined} onClick={()=>{setSection(name);setPage(1);setStatus('');setSelected(null);}}>{React.createElement(sectionIcons[name],{size:18,"aria-hidden":true})}<span>{name}</span></button>)}</nav><small>{session.email}</small><button onClick={async()=>{try{await request('/logout',{method:'POST',headers});setSession(null);}catch(e){setError(e.message);}}}>Sign out</button></aside>
    <main><header><div><p>Restaurant operations</p><h1>{section==='Integrity'?'Booking integrity':section}</h1></div><div className="owner-header-actions"><button onClick={()=>setRefresh(n=>n+1)}>Refresh data</button><a href="/">View website ↗</a></div></header><p className="owner-context">Private owner workspace · Bookings and enquiries from your website</p>
    <div className="owner-filters"><label>Branch<select value={branch} onChange={e=>{setBranch(e.target.value);setPage(1);}}><option value="">All locations</option>{branches.map(b=><option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label><label>From<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label><label>Through<input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label>
    {!overview&&<label>Search<input type="search" placeholder="Name, email or reference" value={q} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>}
    {['Reservations','Enquiries'].includes(section)&&<label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{(section==='Reservations'?['pending','confirmed','cancelled','completed']:['pending','resolved']).map(s=><option key={s}>{s}</option>)}</select></label>}
    {['Reservations','Enquiries','Integrity'].includes(section)&&<button disabled={busy} onClick={exportRows}>Export CSV</button>}
    {section==='Menu'&&<button onClick={()=>setSelected({})}>Add dish</button>}</div>
    {notice&&<p role="status">{notice} <button onClick={()=>setNotice('')}>Dismiss</button></p>}
    {error&&<p className="owner-error" role="alert">{error}<button onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>}
    {section==='Integrity'&&<p>Signals identify records for review. They do not establish that a booking is synthetic. Original records remain visible.</p>}
    {!data&&!error&&<div className="owner-loading" role="status">Loading restaurant data…</div>}
    {data&&overview&&<><div className="owner-stats">{[['Reservations',data.totals[0]?.total??0],['Active bookings today',data.today[0]?.count??0],['Expected guests today',data.today[0]?.guests??0],['Unique customer emails',data.customers?.[0]?.count??0],['Bookings this week',data.week?.[0]?.count??0],['Bookings this month',data.month?.[0]?.count??0],['Enquiries',data.enquiries],['Pending enquiries',data.pendingEnquiries??0]].map(([label,value])=><section key={label}><span>{label}</span><strong>{value.toLocaleString('en-IN')}</strong></section>)}</div><div className="owner-charts"><Distribution title="Daily booking trend" rows={[...data.trend].reverse()}/><Distribution title="Bookings by branch" rows={data.branches}/><Distribution title="Upcoming bookings by branch" rows={data.upcoming}/><Distribution title="Today by branch" rows={data.todayBranches}/><Distribution title="Reservation status" rows={data.statuses}/><Distribution title="Popular seatings" rows={data.hours}/><Distribution title="Guest trend" rows={[...data.trend].reverse()} field="guests"/></div></>}
    {data&&!overview&&<><p>{data.total??items.length} records</p><div className="owner-table"><table><thead><tr>{(section==='Menu'?['Dish','Category','Price','Availability']:section==='Customers'?['Customer','Email','Bookings','Last visit']:['Reference','Customer','Branch','Date','Status']).map(label=><th key={label}>{label}</th>)}<th>Details</th></tr></thead><tbody>{items.map(item=><tr key={item.reference||item.slug||item._id}>
    {section==='Menu'?<><td>{item.name}</td><td>{item.category}</td><td>₹{item.price}</td><td>{item.isAvailable?'Available':'Unavailable'}</td></>:section==='Customers'?<><td>{item.name}</td><td>{item._id}</td><td>{item.bookings}</td><td>{date(item.last)}</td></>:<><td>{item.reference}</td><td>{item.customer?.name||item.name||'—'}</td><td>{item.branch||'—'}</td><td>{date(item.date||item.createdAt)}</td><td>{item.status||'pending'}</td></>}
    <td><button onClick={()=>setSelected(item)}>View</button></td></tr>)}</tbody></table>{!items.length&&<p>No records match these filters.</p>}</div>
    {section!=='Menu'&&<div className="owner-pager"><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button disabled={page*30>=data.total} onClick={()=>setPage(page+1)}>Next</button></div>}</>}
    {selected&&<section className="owner-detail" aria-label="Record details"><button onClick={()=>setSelected(null)}>Close details</button><h2>{selected.name||selected.reference||'New dish'}</h2>
    {section==='Menu'?<form onSubmit={saveDish}>{['name',...selected.slug?[]:['slug'],'description','category','price','image'].map(field=><label key={field}>{field}<input name={field} type={field==='price'?'number':'text'} step={field==='price'?'.01':undefined} min={field==='price'?0:undefined} defaultValue={selected[field]||''} required/></label>)}<label><input name="isAvailable" type="checkbox" defaultChecked={selected.isAvailable??true}/>Available on public menu</label><button disabled={busy}>Save dish</button></form>:<><dl>{Object.entries({...selected,...selected.customer}).filter(([key])=>!['_id','customer'].includes(key)).map(([key,value])=><React.Fragment key={key}><dt>{key}</dt><dd>{Array.isArray(value)?value.join(', '):String(value??'—')}</dd></React.Fragment>)}</dl>
    {['Reservations','Enquiries'].includes(section)&&<label>Update status<select disabled={busy} value={selected.status||'pending'} onChange={e=>update('/'+resource+'/'+selected.reference,{status:e.target.value})}>{(section==='Reservations'?['pending','confirmed','cancelled','completed']:['pending','resolved']).map(s=><option key={s}>{s}</option>)}</select></label>}
    {(selected.customer?.email||section==='Customers')&&<button onClick={()=>{setQuery(selected.customer?.email||selected._id);setSection('Reservations');setPage(1);setStatus('');}}>View booking history</button>}</>}
    </section>}
    </main></div>;
}
