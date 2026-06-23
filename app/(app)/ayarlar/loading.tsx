export default function AyarlarLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6 px-4 pt-4">
      {/* Profile card */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="size-16 rounded-full bg-muted shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-3 w-44 rounded bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted mt-1" />
        </div>
        <div className="size-9 rounded-xl bg-muted shrink-0" />
      </div>
      {/* Sections */}
      {[...Array(3)].map((_, i) => (
        <div key={i}>
          <div className="h-4 w-24 rounded bg-muted mb-2 ml-1" />
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {[...Array(i === 0 ? 2 : 3)].map((_, j) => (
              <div key={j} className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-3.5 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
