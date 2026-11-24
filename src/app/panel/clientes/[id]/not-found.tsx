import Link from 'next/link';
import { EmptyState, btnClass } from '@/components/ui';

export default function ClienteNoEncontrado() {
  return (
    <EmptyState
      title="No encontramos a esta persona"
      text="El enlace puede estar incompleto o el registro ya no existe. Búscala en la lista por nombre o contacto."
      action={<Link href="/panel/clientes" className={btnClass('primary')}>Volver a la lista</Link>}
    />
  );
}
