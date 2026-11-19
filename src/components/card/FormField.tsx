import type { ReactNode } from 'react';

/** Campo con etiqueta, ayuda y error enlazados por aria-describedby. */
export function describedBy(id: string, help?: string, error?: string, extra?: string): string | undefined {
  const ids = [help ? `${id}-help` : '', error ? `${id}-err` : '', extra ?? ''].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function FormField({ id, label, help, error, children, optional, className }: {
  id: string; label: string; help?: ReactNode; error?: string; children: ReactNode; optional?: boolean; className?: string;
}) {
  return (
    <div className={'flex flex-col gap-1.5 ' + (className ?? '')}>
      <label htmlFor={id} className="text-xs font-semibold tracking-wide text-muted">
        {label}{optional && <span className="font-normal"> (opcional)</span>}
      </label>
      {children}
      {help && <p id={`${id}-help`} className="text-xs leading-relaxed text-muted">{help}</p>}
      {error && <p id={`${id}-err`} className="text-xs font-medium text-bad" role="alert">{error}</p>}
    </div>
  );
}

/** Interruptor accesible (role="switch"). Incluye un input oculto para enviarlo en el formulario. */
export function Switch({ id, name, checked, onChange, label, help, disabled }: {
  id: string; name: string; checked: boolean; onChange: (v: boolean) => void; label: string; help?: ReactNode; disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button" id={id} role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={help ? `${id}-help` : undefined}
        disabled={disabled} onClick={() => onChange(!checked)}
        className={'disabled:opacity-50 relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' + (checked ? 'bg-navy' : 'bg-[#9FB1C4]')}
      >
        <span aria-hidden="true" className={'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ' + (checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
      <input type="hidden" name={name} value={checked ? '1' : '0'} />
      <div className="min-w-0">
        <span id={`${id}-label`} className="block cursor-pointer text-sm font-semibold text-navy" onClick={() => { if (!disabled) onChange(!checked); }}>
          {label} <span className="font-normal text-muted">({checked ? 'activado' : 'desactivado'})</span>
        </span>
        {help && <p id={`${id}-help`} className="mt-1 text-xs leading-relaxed text-muted">{help}</p>}
      </div>
    </div>
  );
}
