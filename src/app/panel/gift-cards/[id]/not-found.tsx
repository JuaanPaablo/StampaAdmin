import Link from 'next/link';
import { EmptyState, btnClass } from '@/components/ui';

export default function GiftNoEncontrada() {
  return (
    <EmptyState
      title="No encontramos esta gift card"
      text="El enlace puede estar incompleto o la gift card es de otro negocio."
      action={<Link href="/panel/gift-cards" className={btnClass('primary')}>Volver a gift cards</Link>}
    />
  );
}
