import React, { useState } from 'react';
import { Utensils } from 'lucide-react';

export const scenes = {
  brunch: { src: '/images/menu/brunch/brioche-french-toast.webp', alt: 'Golden brioche French toast with berries and maple', label: 'Breakfast' },
  table: { src: '/images/editorial/kitchen.webp', alt: 'Creamy mushroom Alfredo pasta in a ceramic bowl', label: 'Kitchen' },
  coffee: { src: '/images/editorial/cafe.webp', alt: 'Cappuccino finished with fine milk foam', label: 'Café' }
};

export function Photo({ src, alt, priority = false, sizes = '100vw', className = '', ...rest }) {
  const [failed, setFailed] = useState('');
  if (!src || src === failed) {
    return <span className={'photo-missing ' + className} role="img" aria-label={alt}><Utensils aria-hidden="true" /></span>;
  }
  const highResolution = ['/images/editorial/koramangala.webp', '/images/editorial/whitefield.webp', '/images/editorial/kitchen.webp', '/images/editorial/cafe.webp', '/images/menu/brunch/avocado-feta-sourdough-toast.webp'].includes(src);
  const widths = highResolution ? [360, 720, 1440, 3840] : src.startsWith('/images/menu/') ? [360, 720, 1200] : [];
  return <img className={className} src={src} alt={alt} decoding="async"
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined}
    srcSet={widths.length ? widths.map(w => ((w === 1200 || w === 3840) ? src : src.replace('.webp', '-' + w + '.webp')) + ' ' + w + 'w').join(', ') : undefined}
    sizes={widths.length || rest.srcSet ? sizes : undefined} onError={() => setFailed(src)} {...rest} />;
}
