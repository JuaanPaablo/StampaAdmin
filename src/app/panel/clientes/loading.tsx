export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Cargando clientes">
      <div className="mb-6 h-8 w-48 rounded-lg bg-line" />
      <div className="mb-4 h-11 w-full max-w-xl rounded-xl bg-line" />
      <div className="h-80 rounded-2xl bg-white ring-1 ring-line/70" />
    </div>
  );
}
