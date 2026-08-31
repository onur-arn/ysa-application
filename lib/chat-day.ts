/** WhatsApp-style day label for chat separators (Turkish UI). */
export function chatDayLabel(isoOrDate: string | Date, now = new Date()): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ""

  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((start(now) - start(d)) / 86_400_000)

  if (diffDays === 0) return "Bugün"
  if (diffDays === 1) return "Dün"
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString("tr-TR", { weekday: "long" })
  }
  return d.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  })
}

export function sameChatDay(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}
