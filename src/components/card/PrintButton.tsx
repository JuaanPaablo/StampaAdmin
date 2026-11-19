'use client';

export function PrintButton({ label = 'Imprimir' }: { label?: string }) {
  return (
    <button
      type="button" onClick={() => window.print()}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-sun px-5 text-sm font-semibold text-navy transition hover:bg-sun-2 active:scale-[.98]"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7V3h10v4M5 14H3V8h14v6h-2M5 12h10v5H5z" />
      </svg>
      {label}
    </button>
  );
}
