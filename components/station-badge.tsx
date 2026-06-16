import { cn } from "@/lib/utils"
import { station, type StationId } from "@/lib/data/stations"

export function StationBadge({ id, className }: { id: StationId; className?: string }) {
  const s = station(id)
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", className)}
      style={{ backgroundColor: `hsl(${s.color} / 0.14)`, color: `hsl(${s.color})` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(${s.color})` }} />
      {s.name}
    </span>
  )
}

export function Avatar({
  initials,
  online,
  size = 44,
  color = "188 57% 48%",
}: {
  initials: string
  online?: boolean
  size?: number
  color?: string
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-heading font-bold text-white"
        style={{ backgroundColor: `hsl(${color})`, fontSize: size * 0.36 }}
      >
        {initials}
      </span>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-card",
            online ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </span>
  )
}
