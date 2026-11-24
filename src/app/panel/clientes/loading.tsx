export default function Loading() {
  return (
    <div className="animate-pulse motion-reduce:animate-none" role="status" aria-live="polite">
      <span className="sr-only">Cargando clientes…</span>
      <div className="mb-6 h-8 w-48 rounded-lg bg-line" />
      <div className="mb-4 h-11 w-40 rounded-full bg-line" />
      <div className="mb-4 h-11 w-full max-w-xl rounded-xl bg-line" />
      <div className="mb-5 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-9 w-24 rounded-full bg-line" />)}
      </div>
      <div className="h-80 rounded-2xl bg-white ring-1 ring-line/70" />
    </div>
  );
}
