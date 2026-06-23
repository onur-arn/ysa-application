export default function FeedLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="px-4 pb-1 pt-4">
        <div className="h-8 w-32 rounded-lg bg-muted" />
      </div>

      {/* Stories bar */}
      <div className="flex gap-3 overflow-hidden px-4 py-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="size-14 rounded-full bg-muted" />
            <div className="h-2.5 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Post cards */}
      <div className="flex flex-col gap-3 px-4 pb-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-muted shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-2.5 w-20 rounded bg-muted" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
