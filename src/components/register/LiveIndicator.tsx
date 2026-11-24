'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/** Indica que la pantalla se actualiza sola, o que se perdió la conexión. */
export function LiveIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  return (
    <span role="status" className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', online ? 'text-[#12683F]' : 'text-bad')}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', online ? 'animate-pulse bg-good' : 'bg-bad')} />
      {online ? 'En vivo' : 'Sin conexión'}
    </span>
  );
}
