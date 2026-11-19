import Link from 'next/link';
import { btnClass } from '@/components/ui';

export default function PanelNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-card ring-1 ring-line/70">
      <p className="font-display text-5xl font-extrabold text-navy" aria-hidden="true">404</p>
      <h1 className="mt-2 font-display text-xl font-bold text-navy">No encontramos esa página</h1>
      <p className="mt-2 text-sm text-muted">Puede que el enlace esté mal escrito o que ya no exista. Usa el menú para ir a otra sección.</p>
      <div className="mt-6 flex justify-center">
        <Link href="/panel" className={btnClass('primary')}>Volver al inicio</Link>
      </div>
    </div>
  );
}
