"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]
const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"]

interface DatePickerProps {
  value: string        // "YYYY-MM-DD"
  onChange: (v: string) => void
  className?: string
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)
  const today               = new Date()

  const parsed  = value ? new Date(value + "T00:00:00") : null
  const initial = parsed ?? today
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))

  const year         = cursor.getFullYear()
  const month        = cursor.getMonth()
  const firstDayIdx  = (new Date(year, month, 1).getDay() + 6) % 7   // 0 = Pazartesi
  const daysInMonth  = new Date(year, month + 1, 0).getDate()

  const displayValue = parsed
    ? `${parsed.getDate()} ${MONTHS_TR[parsed.getMonth()]} ${parsed.getFullYear()}`
    : ""

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
    }
  }, [open])

  function selectDay(day: number) {
    const y = String(year).padStart(4, "0")
    const m = String(month + 1).padStart(2, "0")
    const d = String(day).padStart(2, "0")
    onChange(`${y}-${m}-${d}`)
    setOpen(false)
  }

  function isSelected(day: number) {
    return !!parsed && parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day
  }

  function isToday(day: number) {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${className ?? ""} flex w-full items-center gap-2 text-left`}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className={displayValue ? "text-foreground" : "text-muted-foreground"}>
          {displayValue || "Tarih seç"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-border bg-card p-3 shadow-xl">
          {/* Ay navigasyonu */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {MONTHS_TR[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Hafta başlıkları */}
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Günler */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayIdx }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const sel = isSelected(day)
              const tod = isToday(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`relative flex h-9 w-full items-center justify-center rounded-full text-sm transition-colors
                    ${sel
                      ? "bg-primary font-semibold text-primary-foreground"
                      : tod
                        ? "font-bold text-primary"
                        : "text-foreground active:bg-secondary"
                    }`}
                >
                  {day}
                  {tod && !sel && (
                    <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Temizle */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false) }}
              className="mt-3 w-full rounded-xl py-2 text-sm font-medium text-muted-foreground active:bg-secondary"
            >
              Temizle
            </button>
          )}
        </div>
      )}
    </div>
  )
}
