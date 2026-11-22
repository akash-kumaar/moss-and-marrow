import React, { useEffect, useRef } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { Photo } from '../components/Photo.jsx';
import { priceText } from './catalog.js';

export function DishPhoto({ item, className = '', eager = false }) {
  return <Photo className={`shop-photo ${className}`} src={item.image} alt={item.name}
    width="480" height="360" priority={eager} sizes={eager ? '(max-width:580px) 92vw, 380px' : '136px'} />;
}

export function DishRow({ item, show, add }) {
  return <article className="shop-dish">
    <button className="shop-dish-open" onClick={() => show(item)} aria-label={`View ${item.name} details`}>
      <span className="shop-thumb"><DishPhoto item={item} /></span>
      <span className="shop-dish-copy">
        <span className="shop-dish-name">{item.name}</span>
        <span className="shop-description">{item.description}</span>
        {((item.dietaryTags?.length > 0) || item.isFeatured || item.isPopular) && <span className="shop-tags">
          {item.isFeatured && <span>Signature</span>}{item.isPopular && <span>Popular</span>}
          {item.dietaryTags?.map(tag => <span key={tag}>{tag}</span>)}
        </span>}
        <span className="shop-price">{priceText(item.price)}</span>
      </span>
    </button>
    <button className="shop-icon" aria-label={`Add ${item.name} to bag`} onClick={() => add(item)}><Plus size={17} /></button>
  </article>;
}

export function DishDialog({ item, close, add }) {
  const ref = useRef(null);
  const [quantity, setQuantity] = React.useState(1);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="shop-dialog" aria-labelledby="shop-dialog-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === ref.current) close(); }}>
    <div className="shop-dialog-inner">
      <button className="shop-icon shop-dialog-close" aria-label="Close dish details" onClick={close}><X size={20} /></button>
      <DishPhoto item={item} eager />
      <div className="shop-dialog-copy">
        <span className="eyebrow">{item.category}</span>
        <h2 id="shop-dialog-title">{item.name}</h2>
        <p>{item.description}</p>
        {item.ingredients?.length > 0 && <p><strong>Ingredients</strong> {item.ingredients.join(', ')}</p>}
        {item.dietaryTags?.length > 0 && <p><strong>Dietary information</strong> {item.dietaryTags.join(', ')}</p>}
        <p className="shop-dietary">{item.allergens?.length ? `Listed allergens include ${item.allergens.join(', ')}.` : 'Please ask the team about allergens before ordering.'}</p>
        <div className="shop-detail-quantity" aria-label="Quantity">
          <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus size={15}/></button>
          <output aria-live="polite">{quantity}</output>
          <button type="button" aria-label="Increase quantity" onClick={() => setQuantity(value => value + 1)}><Plus size={15}/></button>
        </div>
        <button className="button" onClick={() => { add(item, quantity); close(); }}>Add to bag · {priceText(item.price * quantity)} <Plus size={16} /></button>
      </div>
    </div>
  </dialog>;
}
