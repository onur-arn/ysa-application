export default function AgendaLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <div className="h-8 w-24 rounded-lg bg-muted" />
        <div className="size-9 rounded-xl bg-muted" />
      </div>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="size-8 rounded-full bg-muted" />
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="size-8 rounded-full bg-muted" />
      </div>
      {/* Calendar grid */}
      <div className="mx-4 rounded-2xl border border-border bg-card p-3">
        {/* Day labels */}
        <div className="grid grid-cols-7 mb-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex justify-center">
              <div className="h-3 w-6 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Date cells */}
        {[...Array(5)].map((_, row) => (
          <div key={row} className="grid grid-cols-7 gap-1 mb-1">
            {[...Array(7)].map((_, col) => (
              <div key={col} className="flex justify-center">
                <div className="size-8 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Event list */}
      <div className="flex flex-col gap-3 px-4 pt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 flex gap-3">
            <div className="w-1 rounded-full bg-muted self-stretch" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
