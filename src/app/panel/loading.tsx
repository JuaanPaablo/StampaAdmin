export default function PanelLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Cargando…</span>
      <div className="mb-6 space-y-2">
        <div className="h-8 w-56 rounded-lg bg-[#DCE5EF]" />
        <div className="h-4 w-80 max-w-full rounded bg-[#E6EDF5]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line/70">
            <div className="h-3 w-24 rounded bg-[#E6EDF5]" />
            <div className="h-8 w-20 rounded bg-[#DCE5EF]" />
            <div className="h-3 w-32 rounded bg-[#E6EDF5]" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-2xl bg-white shadow-card ring-1 ring-line/70 lg:col-span-2" />
        <div className="h-64 rounded-2xl bg-white shadow-card ring-1 ring-line/70" />
      </div>
    </div>
  );
}
