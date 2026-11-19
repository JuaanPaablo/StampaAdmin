export default function Loading() {
  return (
    <div role="status" aria-label="Cargando la tarjeta" className="animate-pulse">
      <div className="mb-6 h-8 w-40 rounded-lg bg-line" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="h-56 rounded-2xl bg-white ring-1 ring-line/70" />
          <div className="h-72 rounded-2xl bg-white ring-1 ring-line/70" />
        </div>
        <div className="h-96 rounded-2xl bg-white ring-1 ring-line/70" />
      </div>
    </div>
  );
}
