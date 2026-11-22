import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, MapPin, Search, ShoppingBag, X } from 'lucide-react';
import { availableAt, priceText } from './catalog.js';
import { DishDialog, DishRow } from './Dish.jsx';

export function MenuPage({ catalog, cart, branches = [] }) {
  const [params, setParams] = useSearchParams();
  const branch = branches.find(entry => entry.slug === params.get('branch')?.toLowerCase());
  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState('');
  const [dietary, setDietary] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const offered = catalog.items.filter(item => availableAt(item, branch?.slug));
  const requestedSlug = params.get('dish')?.replace('-&-', '-');
  const selected = offered.find(item => item.slug === requestedSlug);
  const setSelected = item => {
    const next = new URLSearchParams(params);
    if (item) next.set('dish', item.slug);
    else next.delete('dish');
    setParams(next, { replace: true, preventScrollReset: true });
  };
  const categories = [...new Set(offered.map(item => item.category))];
  const dietaryOptions = [...new Set(offered.flatMap(item => Array.isArray(item.dietaryTags) ? item.dietaryTags : []))];
  const activeCategory = categories.includes(category) ? category : '';
  const activeDietary = dietaryOptions.includes(dietary) ? dietary : '';
  const search = query.trim().toLowerCase();
  const matches = offered.filter(item => (!activeCategory || item.category === activeCategory) &&
    (!activeDietary || item.dietaryTags?.includes(activeDietary)) &&
    [item.name, item.description, item.category].some(value => value?.toLowerCase().includes(search)));
  const add = (item, quantity = 1) => {
    cart.add(item, quantity);
    setAnnouncement(`${item.name}${quantity > 1 ? ` × ${quantity}` : ''} added. Your bag has ${cart.count + quantity} items.`);
  };

  return <main className="shop-page">
    <div className="wrap shop-title">
      <div><p className="eyebrow">Café & kitchen</p><h1>The <i>menu.</i></h1></div>
      <Link className="shop-location" to="/locations"><MapPin size={16} />{branch?.name || 'All locations'}<ArrowUpRight size={14} /></Link>
    </div>
    <div className="wrap">
      <div className="shop-tools">
        <label className="shop-search"><Search size={18} /><input type="search" aria-label="Search the menu" placeholder="Search the menu" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="shop-categories" role="group" aria-label="Menu categories">
          {['', ...categories].map(value => <button key={value} aria-pressed={activeCategory === value} onClick={() => setCategory(value)}>{value || 'All dishes'}</button>)}
        </div>
        {dietaryOptions.length > 0 && <div className="shop-categories shop-dietary-filters" role="group" aria-label="Dietary filters">
          <span className="eyebrow">Dietary</span>
          {['', ...dietaryOptions].map(value => <button key={value || 'all-dietary'} aria-pressed={activeDietary === value} onClick={() => setDietary(value)}>{value || 'All'}</button>)}
        </div>}
      </div>
      {catalog.loading && <div className="shop-loading" role="status" aria-label="Checking live menu" />}
      {catalog.error && <p className="shop-api-note" role="status">{catalog.error} <button onClick={catalog.retry}>Retry</button></p>}
      <div className="shop-results">
        {categories.map(name => {
          const sectionItems = matches.filter(item => item.category === name);
          return sectionItems.length > 0 && <section className="shop-section" key={`${name}-${activeCategory}`}>
            <h2>{name}</h2><div className="shop-list">{sectionItems.map(item => <DishRow key={item.slug} item={item} show={setSelected} add={add} />)}</div>
          </section>;
        })}
        {matches.length === 0 && !catalog.loading && <div className="shop-empty" role="status">
          <h2>{offered.length ? 'No dishes match your search.' : 'The menu is currently unavailable.'}</h2>
          {(search || category || dietary) && <button className="button secondary" onClick={() => { setQuery(''); setCategory(''); setDietary(''); }}>Clear filters <X size={14} /></button>}
        </div>}
      </div>
    </div>
    {cart.count > 0 && <div className="shop-bag-bar"><Link to="/checkout"><ShoppingBag size={18} /> View bag ({cart.count}) <strong>{priceText(cart.total)}</strong></Link></div>}
    <span className="shop-sr" role="status">{announcement}</span>
    {selected && <DishDialog item={selected} add={add} close={() => setSelected(null)} />}
  </main>;
}
