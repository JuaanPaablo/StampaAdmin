import Link from 'next/link';
import { EmptyState, btnClass } from '@/components/ui';

export default function AdminBusinessNotFound() {
  return (
    <EmptyState
      title="No encontramos ese negocio"
      text="Puede que el enlace esté mal escrito."
      action={<Link href="/admin/negocios" className={btnClass('primary', 'sm') + ' mt-2'}>Ver todos los negocios</Link>}
    />
  );
}
