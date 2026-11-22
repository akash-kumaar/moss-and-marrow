import React, {useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {Minus,Plus,Trash2,X} from 'lucide-react';
import {DishPhoto} from './Dish';
import {priceText} from './catalog';

export default function BagDrawer({cart,onClose}){
  const ref=useRef(null);
  useEffect(()=>{
    const dialog=ref.current;
    dialog.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{dialog.close();document.body.style.overflow=overflow};
  },[]);
  const close=()=>{
    const dialog=ref.current;
    if(dialog.dataset.closing)return;
    dialog.dataset.closing='true';
    const motion=dialog.animate([{transform:'translateX(0)'},{transform:'translateX(100%)'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:220,fill:'forwards'});
    motion.finished.then(onClose,()=>{});
  };
  return <dialog ref={ref} className="bag-drawer" aria-labelledby="bag-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===ref.current)close()}}>
    <div className="bag-content">
      <header><h2 id="bag-title">Your bag</h2><button autoFocus className="shop-icon" aria-label="Close bag" onClick={close}><X size={18}/></button></header>
      <div className="bag-items">
        {cart.entries.length===0 ? <p>Your bag is empty. <Link to="/menu" onClick={onClose}>Browse the menu</Link></p> : cart.entries.map(({item,quantity})=><article className="shop-bag-entry" key={item.slug}>
          <span className="shop-thumb"><DishPhoto item={item}/></span>
          <div className="shop-entry-main"><h3>{item.name}</h3><p>{priceText(item.price)} each</p>
            <div className="shop-stepper">
              <button aria-label={'Decrease '+item.name} onClick={()=>cart.change(item.slug,-1)}><Minus size={14}/></button>
              <output aria-label={item.name+' quantity'}>{quantity}</output>
              <button aria-label={'Increase '+item.name} onClick={()=>cart.change(item.slug,1)}><Plus size={14}/></button>
            </div>
          </div>
          <button className="shop-icon" aria-label={'Remove '+item.name} onClick={()=>cart.change(item.slug,-quantity)}><Trash2 size={15}/></button>
        </article>)}
      </div>
      {cart.count>0&&<footer><p aria-live="polite">Subtotal <strong>{priceText(cart.total)}</strong></p><p>Saved on this device for ordering at the restaurant.</p><Link className="button" to="/checkout" onClick={onClose}>View saved bag</Link><button className="arrow-link bag-clear" onClick={cart.clear}>Clear bag</button></footer>}
    </div>
  </dialog>;
}
