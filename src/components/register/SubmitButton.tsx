'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'dark' | 'ghost' | 'danger';

/** Botón de envío con estado pendiente (spinner + texto). Debe vivir dentro de un <form>. */
export function SubmitButton({ children, pendingText = 'Un momento…', variant = 'primary', size = 'md', className, disabled = false }: {
  children: ReactNode; pendingText?: string; variant?: Variant; size?: 'md' | 'sm'; className?: string; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} className={cn(btnClass(variant, size), className)}>
      {pending && (
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 animate-spin">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity=".25" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {pending ? pendingText : children}
    </button>
  );
}
