import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import './style.css';
import BagDrawer from './shop/BagDrawer';
import FoodPointer from './components/FoodPointer';
import './shop/shop.css';
import { Header, Footer } from './components/Shell';
import Home, { StorySection, BookingCTA } from './pages/Home';
import { Gallery } from './pages/Gallery';
import { useCatalog } from './shop/catalog';
import { useCart } from './shop/cart';
import { branches } from './visit/branches';
import { LocationsPage, BranchPage } from './visit/Locations';

const MenuPage = lazy(() => import('./shop/MenuPage').then(m => ({default: m.MenuPage})));
const CheckoutPage = lazy(() => import('./shop/CheckoutPage').then(m => ({default: m.CheckoutPage})));
const form = name => lazy(() => import('./visit/Forms').then(m => ({default: m[name]})));
const ReservationPage = form('ReservationPage');
const ContactPage = form('ContactPage');
const PrivateDiningPage = form('PrivateDiningPage');
const titles = {menu:'Menu',locations:'Locations',gallery:'Gallery',story:'Our story',reservations:'Reservations',checkout:'Your bag',contact:'Contact',private:'Private dining','private-dining':'Private dining'};

function App() {
  const catalog = useCatalog();
  const cart = useCart();
  const [bagOpen, setBagOpen] = React.useState(false);
  const { pathname } = useLocation();
  const lastPath = useRef(pathname);
  const page = useRef(null);
  useEffect(() => {
    const [,base,slug] = pathname.split('/');
    const label = base === 'locations' && slug ? branches.find(b => b.slug === slug)?.name : titles[base];
    document.title = (label ? label + ' · ' : '') + 'Moss & Marrow';
    if (lastPath.current !== pathname) {
      window.scrollTo({top:0,behavior:'instant'});
      page.current?.focus({preventScroll:true});
      lastPath.current = pathname;
    }
  }, [pathname]);

  return <><a className="skip" href="#page">Skip to content</a><Header count={cart.count} openBag={() => setBagOpen(true)}/>
    <div ref={page} key={pathname} id="page" className="page-enter" tabIndex="-1">
      <Suspense fallback={<main className="wrap page-skeleton" aria-busy="true" aria-label="Loading page"><span/><span/></main>}>
        <Routes>
          <Route path="/" element={<main><Home catalog={catalog}/></main>}/>
          <Route path="/story" element={<main><StorySection page/><BookingCTA/></main>}/>
          <Route path="/menu" element={<MenuPage catalog={catalog} cart={cart} branches={branches}/>}/>
          <Route path="/checkout" element={<CheckoutPage cart={cart}/>}/>
          <Route path="/locations" element={<LocationsPage/>}/>
          <Route path="/locations/:slug" element={<BranchPage/>}/>
          <Route path="/gallery" element={<main><Gallery/></main>}/>
          <Route path="/reservations" element={<ReservationPage/>}/>
          <Route path="/contact" element={<ContactPage/>}/>
          <Route path="/private-dining" element={<PrivateDiningPage/>}/>
          <Route path="/private" element={<PrivateDiningPage/>}/>
          <Route path="*" element={<main className="wrap block"><h1>Page unavailable</h1><Link className="arrow-link" to="/">Return home</Link></main>}/>
        </Routes>
      </Suspense>
    </div><Footer/><FoodPointer/>{bagOpen && <BagDrawer cart={cart} onClose={() => setBagOpen(false)}/>}</>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
