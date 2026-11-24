import { cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Kit de UI compartido. Componentes de servidor, sin estado. Si necesitas algo nuevo, créalo en TU carpeta de módulo. */

type BtnVariant = 'primary' | 'dark' | 'ghost' | 'danger';
export const btnClass = (variant: BtnVariant = 'primary', size: 'md' | 'sm' = 'md') =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none',
    // 'sm' mide 44 px en pantallas táctiles (mínimo para el dedo) y 36 px desde sm.
    size === 'md' ? 'h-11 px-5 text-sm' : 'h-11 px-4 text-[13px] sm:h-9',
    variant === 'primary' && 'bg-sun text-navy hover:bg-sun-2',
    variant === 'dark' && 'bg-navy text-white hover:bg-navy-2',
    variant === 'ghost' && 'bg-white text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface',
    variant === 'danger' && 'bg-white text-bad ring-1 ring-inset ring-[#E7B7B3] hover:bg-[#FBE9E7]'
  );

export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'md' | 'sm' }) {
  return <button {...p} className={cn(btnClass(variant, size), className)} />;
}

export function Card({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={cn('rounded-2xl bg-white p-5 shadow-card ring-1 ring-line/70', className)}>{children}</Tag>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'sun';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface text-muted', ok: 'bg-[#DDF3E8] text-[#12683F]', warn: 'bg-[#FFF3CC] text-[#7A5A00]',
  bad: 'bg-[#FBE0DE] text-[#9B2A22]', info: 'bg-[#E3EDF8] text-navy', sun: 'bg-sun text-navy'
};
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap', tones[tone])}>{children}</span>;
}

export function Stat({ label, value, hint, delta }: { label: string; value: ReactNode; hint?: string; delta?: { value: string; good: boolean } }) {
  return (
    <Card as="div" className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="font-display text-3xl font-bold tracking-tight text-navy tabular-nums">{value}</span>
      <span className="flex items-center gap-2 text-xs text-muted">
        {delta && <span className={cn('font-semibold', delta.good ? 'text-[#12683F]' : 'text-bad')}>{delta.value}</span>}
        {hint}
      </span>
    </Card>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#C9D6E3] bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-base font-semibold text-navy">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export const inputClass = 'h-11 w-full rounded-xl border-[1.5px] border-[#C9D6E3] bg-white px-3.5 text-[15px] text-navy placeholder:text-[#8da2b8] focus:border-navy focus:outline-none focus:ring-4 focus:ring-sun/50';

/**
 * Campo con etiqueta. Si hay `htmlFor`, la ayuda o el error quedan ligados al control (aria-describedby) y el control
 * se marca aria-invalid cuando hay error. El error se anuncia con aria-live (sin role=alert, que se duplicaría con el
 * aviso general del formulario).
 */
export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  const msgId = htmlFor && (error || hint) ? `${htmlFor}-msg` : undefined;
  const child = msgId && isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': (children.props as Record<string, unknown>)['aria-describedby'] ?? msgId,
        ...(error ? { 'aria-invalid': true } : {})
      })
    : children;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-muted">{label}</label>
      {child}
      {error ? <p id={msgId} className="text-xs text-bad" aria-live="polite">{error}</p> : hint ? <p id={msgId} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((p, ref) => <input ref={ref} {...p} className={cn(inputClass, p.className)} />);
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((p, ref) => <select ref={ref} {...p} className={cn(inputClass, 'pr-8', p.className)} />);
Select.displayName = 'Select';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>((p, ref) => <textarea ref={ref} {...p} className={cn(inputClass, 'h-auto min-h-24 py-2.5', p.className)} />);
Textarea.displayName = 'Textarea';

/** Tabla con desplazamiento lateral. La caja recibe foco para poder desplazarla con el teclado. */
export function Table({ children, className, label = 'Tabla' }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div tabIndex={0} role="region" aria-label={label} className={cn('relative overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-line/70', className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => <th className={cn('whitespace-nowrap border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted', className)}>{children}</th>;
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn('border-b border-line/70 px-4 py-3 align-middle text-navy tabular-nums', className)}>{children}</td>;

/** Mini barra de progreso 0..1 */
export function Meter({ value, tone = 'navy' }: { value: number; tone?: 'navy' | 'bad' | 'sun' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="presentation">
      <div className={cn('h-full rounded-full', tone === 'navy' && 'bg-navy', tone === 'bad' && 'bg-bad', tone === 'sun' && 'bg-sun')} style={{ width: Math.max(0, Math.min(1, value)) * 100 + '%' }} />
    </div>
  );
}
