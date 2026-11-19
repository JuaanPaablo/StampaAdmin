export default function Loading() {
  return (
    <div role="status" aria-label="Cargando el equipo" className="animate-pulse space-y-4">
      <div className="h-8 w-40 rounded-lg bg-line" />
      <div className="h-56 rounded-2xl bg-white ring-1 ring-line/70" />
      <div className="h-72 rounded-2xl bg-white ring-1 ring-line/70" />
    </div>
  );
}
