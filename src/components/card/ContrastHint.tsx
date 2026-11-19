import { ratioText } from './contrast';

/** Aviso de contraste WCAG. Usa icono y texto, no solo color. */
export function ContrastHint({ id, label, ratio, min }: { id?: string; label: string; ratio: number; min: number }) {
  const ok = ratio >= min;
  return (
    <p id={id} className={'flex items-start gap-2 text-xs ' + (ok ? 'text-[#12683F]' : 'text-[#9B2A22]')}>
      <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-px h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {ok ? <path d="M4 10.5l4 4 8-9" /> : <><path d="M10 3l8 14H2L10 3z" /><path d="M10 8.5v4M10 15h.01" /></>}
      </svg>
      <span>
        <strong>{label}:</strong> contraste {ratioText(ratio)} a 1.{' '}
        {ok ? 'Se lee bien.' : `Es bajo (mínimo ${ratioText(min)}). Elige un tono más claro u oscuro para que se lea.`}
      </span>
    </p>
  );
}
