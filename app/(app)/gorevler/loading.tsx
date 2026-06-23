export default function TasksLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <div className="h-8 w-28 rounded-lg bg-muted" />
        <div className="size-9 rounded-xl bg-muted" />
      </div>
      <div className="flex gap-2 px-4 py-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-muted" />
        ))}
      </div>
      <div className="flex flex-col gap-3 px-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="size-5 rounded-full bg-muted shrink-0" />
              <div className="h-4 flex-1 rounded bg-muted" />
              <div className="h-5 w-14 rounded-full bg-muted" />
            </div>
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-muted" />
              <div className="h-6 w-16 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
