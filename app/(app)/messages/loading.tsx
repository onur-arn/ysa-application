export default function MessagesLoading() {
  return (
    <div className="animate-pulse">
      <div className="px-4 pb-1 pt-4">
        <div className="h-8 w-28 rounded-lg bg-muted" />
      </div>
      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3">
        <div className="h-9 w-24 rounded-xl bg-muted" />
        <div className="h-9 w-24 rounded-xl bg-muted" />
      </div>
      {/* Conversation rows */}
      <div className="flex flex-col gap-0 mx-4 overflow-hidden rounded-2xl border border-border bg-card">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
            <div className="size-11 rounded-full bg-muted shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-2.5 w-10 rounded bg-muted" />
              </div>
              <div className="h-3 w-40 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
