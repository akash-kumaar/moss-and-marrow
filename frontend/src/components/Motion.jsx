import React, { useEffect, useRef } from 'react';

export function Reveal({ children, className = '', ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.add('arrive');
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -24px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={className} {...props}>{children}</div>;
}

export function SplitText({ as: Tag = 'span', children, className = '', ...props }) {
  const text = String(children ?? '');
  const words = text.split(/\s+/).filter(Boolean);
  return <Tag className={'split-text ' + className} aria-label={text} {...props}>
    <span aria-hidden="true">{words.map((word, index) => <React.Fragment key={`${word}-${index}`}>
      {index > 0 && ' '}<span className="split-word" style={{ '--word-index': index }}><span>{word}</span></span>
    </React.Fragment>)}</span>
  </Tag>;
}

export function Magnetic({ children }) {
  const ref = useRef(null);
  const move = event => {
    if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = (event.clientX - bounds.left - bounds.width / 2) * .12;
    const y = (event.clientY - bounds.top - bounds.height / 2) * .12;
    ref.current.style.setProperty('--mag-x', `${x}px`);
    ref.current.style.setProperty('--mag-y', `${y}px`);
  };
  const reset = () => {
    ref.current?.style.setProperty('--mag-x', '0px');
    ref.current?.style.setProperty('--mag-y', '0px');
  };
  return <span ref={ref} className="magnetic-shell" onPointerMove={move} onPointerLeave={reset}>{children}</span>;
}
