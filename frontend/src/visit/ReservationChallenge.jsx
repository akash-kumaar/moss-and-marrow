import React, { useEffect, useRef, useState } from 'react';

export default function ReservationChallenge({ api, reset }) {
  const node = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let widget;
    const controller = new AbortController();
    async function mount() {
      const response = await fetch(api + '/reservations/config', {signal:controller.signal});
      if (!response.ok) throw new Error();
      const {siteKey} = await response.json();
      if (!active || !siteKey) return;
      if (!window.turnstile) await new Promise((resolve, reject) => {
        let script = document.querySelector('script[data-reservation-challenge]');
        if (!script) {
          script = document.createElement('script');
          script.dataset.reservationChallenge = 'true';
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          document.head.append(script);
        }
        script.addEventListener('load', resolve, {once:true});
        script.addEventListener('error', () => { script.remove(); reject(new Error()); }, {once:true});
      });
      if (active) widget = window.turnstile.render(node.current, {sitekey:siteKey, action:'reservation'});
    }
    setFailed(false);
    mount().catch(() => { if (active) setFailed(true); });
    return () => { active = false; controller.abort(); if (widget !== undefined) window.turnstile?.remove(widget); };
  }, [api, reset]);
  return <><div ref={node}/>{failed && <p role="status">Verification could not load. Refresh the page to retry.</p>}</>;
}
