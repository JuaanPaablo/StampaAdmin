'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui';

/** Botón de envío con estado pendiente (useFormStatus). Debe estar dentro de un <form>. */
export function SubmitButton({ children, pendingText = 'Guardando…', variant = 'primary', disabled, className }: {
  children: ReactNode; pendingText?: string; variant?: 'primary' | 'dark' | 'ghost' | 'danger'; disabled?: boolean; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled} aria-busy={pending} className={className}>
      {pending ? pendingText : children}
    </Button>
  );
}
