"use client"

import { STATIONS } from "@/lib/data/stations"
import { Check } from "lucide-react"

export function StationSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STATIONS.map((s) => {
        const selected = value === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              selected ? "border-primary bg-primary/10 text-foreground" : "border-input bg-card text-muted-foreground"
            }`}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ backgroundColor: `hsl(${s.color})` }}
            >
              {s.short}
            </span>
            <span className="truncate font-medium">{s.city}</span>
            {selected && <Check className="ml-auto size-4 shrink-0 text-primary" />}
          </button>
        )
      })}
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  "h-12 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
