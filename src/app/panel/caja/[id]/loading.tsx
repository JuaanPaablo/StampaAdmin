export default function Loading() {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-6 sm:gap-8" aria-busy="true" aria-label="Cargando">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-line" />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="h-[34rem] animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
        <div className="h-[34rem] animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
      </div>
    </div>
  );
}
