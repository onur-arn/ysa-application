export default function AnnuaireLoading() {
  return (
    <div className="animate-pulse">
      <div className="px-4 pb-1 pt-4">
        <div className="h-8 w-36 rounded-lg bg-muted" />
      </div>
      {/* Search bar */}
      <div className="px-4 py-3">
        <div className="h-11 w-full rounded-xl bg-muted" />
      </div>
      {/* Station filter chips */}
      <div className="flex gap-2 overflow-hidden px-4 pb-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-muted shrink-0" />
        ))}
      </div>
      {/* Member rows */}
      <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border mx-4 bg-card">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
            <div className="size-10 rounded-full bg-muted shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-3.5 w-32 rounded bg-muted" />
              <div className="h-2.5 w-20 rounded bg-muted" />
            </div>
            <div className="h-5 w-14 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
