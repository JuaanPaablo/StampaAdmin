export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-line" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[34rem] animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
        <div className="h-[34rem] animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
      </div>
    </div>
  );
}
