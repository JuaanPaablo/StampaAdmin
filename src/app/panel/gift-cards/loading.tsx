export default function Loading() {
  return (
    <div className="animate-pulse motion-reduce:animate-none" role="status" aria-live="polite">
      <span className="sr-only">Cargando gift cards…</span>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="h-8 w-40 rounded-lg bg-line" />
        <div className="h-11 w-36 rounded-full bg-line" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-white ring-1 ring-line/70" />)}</div>
      <div className="h-72 rounded-2xl bg-white ring-1 ring-line/70" />
    </div>
  );
}
