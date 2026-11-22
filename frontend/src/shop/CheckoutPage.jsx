import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { priceText } from './catalog.js';
import { DishPhoto } from './Dish.jsx';

export function CheckoutPage({ cart }) {
  return <main className="shop-page wrap">
    <div className="shop-title"><div><Link className="shop-back" to="/menu"><ArrowLeft size={15} /> Back to menu</Link><h1>Your <i>bag.</i></h1></div></div>
    {cart.count === 0 ? <div className="shop-empty"><ShoppingBag size={32} /><h2>Your bag is empty.</h2><Link className="button" to="/menu">Explore the menu <ArrowUpRight size={16} /></Link></div> :
      <div className="shop-bag-layout">
        <div className="shop-bag-list">{cart.entries.map(({ item, quantity }) => <article key={item.slug} className="shop-bag-entry">
          <span className="shop-thumb"><DishPhoto item={item} /></span>
          <div className="shop-entry-main"><span className="eyebrow">{item.category}</span><h2>{item.name}</h2><span>{priceText(item.price)} each</span>
            <div className="shop-stepper">
              <button aria-label={`Decrease ${item.name} quantity`} onClick={() => cart.change(item.slug, -1)}><Minus size={14} /></button>
              <output aria-label={`${item.name} quantity`}>{quantity}</output>
              <button aria-label={`Increase ${item.name} quantity`} onClick={() => cart.change(item.slug, 1)}><Plus size={14} /></button>
            </div>
          </div>
          <div className="shop-entry-end"><strong>{priceText(item.price * quantity)}</strong><button aria-label={`Remove ${item.name} from bag`} onClick={() => cart.change(item.slug, -quantity)}><Trash2 size={16} /></button></div>
        </article>)}</div>
        <aside className="shop-summary"><h2>Bag summary</h2><p className="shop-summary-line"><span>Subtotal ({cart.count})</span><strong>{priceText(cart.total)}</strong></p>
          <p>Your selection is saved on this device. Orders are taken at the restaurant.</p>
          <Link className="button" to="/reservations">Reserve a table <ArrowUpRight size={16} /></Link>
          <Link className="shop-summary-link" to="/menu">Continue browsing</Link>
        </aside>
      </div>}
  </main>;
}
