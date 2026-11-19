'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'dark' | 'ghost' | 'danger';

/** Botón de envío con estado pendiente. Debe vivir dentro de un <form>. */
export function SubmitButton({ children, pendingText = 'Un momento…', variant = 'primary', size = 'md', className }: {
  children: ReactNode; pendingText?: string; variant?: Variant; size?: 'md' | 'sm'; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={cn(btnClass(variant, size), className)}>
      {pending ? pendingText : children}
    </button>
  );
}
