/** Esqueleto de la ficha (sin él se mostraría el de la lista). */
export default function Loading() {
  return (
    <div className="animate-pulse motion-reduce:animate-none" role="status" aria-live="polite">
      <span className="sr-only">Cargando ficha…</span>
      <div className="mb-4 h-5 w-24 rounded bg-line" />
      <div className="mb-6 h-8 w-56 rounded-lg bg-line" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="flex flex-col gap-4">
          <div className="h-64 rounded-2xl bg-line" />
          <div className="h-28 rounded-2xl bg-white ring-1 ring-line/70" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-36 rounded-2xl bg-white ring-1 ring-line/70" />
          <div className="h-44 rounded-2xl bg-white ring-1 ring-line/70" />
        </div>
      </div>
    </div>
  );
}
