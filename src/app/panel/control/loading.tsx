export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">Cargando control…</span>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-line" />
        <div className="h-[52px] w-60 animate-pulse rounded-full bg-white ring-1 ring-line/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />)}</div>
      <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
      <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
    </div>
  );
}
