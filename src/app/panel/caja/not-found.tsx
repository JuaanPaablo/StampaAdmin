import Link from 'next/link';
import { btnClass, EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <EmptyState title="No encontramos ese código" text="Puede que el enlace esté mal escrito o que sea de otro negocio."
        action={<Link href="/panel/caja" className={btnClass('primary')}>Volver a la caja</Link>} />
    </div>
  );
}
