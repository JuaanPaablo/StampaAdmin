/** Isotipo de Stampa (SVG) y wordmark. Componente de servidor, sin estado. */
export function Isotipo({ size = 32, color = '#FFFFFF', dot = '#FFC301', className }: { size?: number; color?: string; dot?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Stampa" className={className}>
      <path d="M56.10 19.98A38 38 0 1 0 80.02 43.90A22 22 0 0 1 56.10 19.98Z" fill={color} />
      <circle cx="78" cy="22" r="11" fill={dot} />
    </svg>
  );
}

export function Wordmark({ dark = false, size = 'md' }: { dark?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Isotipo size={size === 'lg' ? 40 : 32} color={dark ? '#001D3D' : '#FFFFFF'} />
      <span className={(dark ? 'text-navy ' : 'text-white ') + 'font-display font-bold tracking-tight ' + (size === 'lg' ? 'text-3xl' : 'text-2xl')}>stampa</span>
    </span>
  );
}
