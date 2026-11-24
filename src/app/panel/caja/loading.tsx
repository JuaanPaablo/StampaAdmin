export default function Loading() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 sm:gap-8 xl:max-w-6xl" aria-busy="true" aria-label="Cargando">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-line" />
      <div className="flex flex-col gap-6 sm:gap-8 xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
        <div className="h-96 animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
        <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-line/70" />
      </div>
    </div>
  );
}
