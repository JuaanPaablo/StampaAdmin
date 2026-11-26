import Link from 'next/link';
import { EmptyState, btnClass } from '@/components/ui';

export default function CuponNoEncontrado() {
  return (
    <EmptyState
      title="No encontramos este cupón"
      text="El enlace puede estar incompleto o el cupón es de otro negocio."
      action={<Link href="/panel/cupones" className={btnClass('primary')}>Volver a cupones</Link>}
    />
  );
}
