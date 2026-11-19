import Link from 'next/link';
import { EmptyState, btnClass } from '@/components/ui';

export default function ClienteNoEncontrado() {
  return (
    <EmptyState
      title="No encontramos a esta persona"
      text="Puede que el enlace esté incompleto o que el registro ya no exista. Vuelve a la lista y búscala por nombre o contacto."
      action={<Link href="/panel/clientes" className={btnClass('primary', 'sm')}>Volver a la lista</Link>}
    />
  );
}
