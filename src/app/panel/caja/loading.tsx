export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-line" />
      <div className="h-96 animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
      <div className="h-48 animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
    </div>
  );
}
