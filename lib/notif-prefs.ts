/** Client-side notification preference helpers (localStorage + browser Notification). */

export type NotifPrefs = {
  genel: boolean
  gorev: boolean
  messages: boolean
  eventReminder: boolean
}

export const NOTIF_PREFS_KEY = "ys-notif-prefs"

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  genel: false,
  gorev: false,
  messages: false,
  eventReminder: false,
}

export function readNotifPrefs(): NotifPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) ?? "{}") as Partial<NotifPrefs>
    return {
      genel: saved.genel ?? false,
      gorev: saved.gorev ?? false,
      messages: saved.messages ?? false,
      eventReminder: saved.eventReminder ?? false,
    }
  } catch {
    return { ...DEFAULT_NOTIF_PREFS }
  }
}

export function writeNotifPrefs(prefs: NotifPrefs) {
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}

export function showAppNotification(title: string, opts: {
  body?: string
  tag?: string
  url?: string
}) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return
  const body = opts.body ?? ""
  const tag = opts.tag
  const url = opts.url ?? "/feed"
  navigator.serviceWorker?.ready
    .then((reg) => {
      void reg.showNotification(title, {
        body,
        icon: "/icon.png",
        badge: "/icon.png",
        tag,
        data: { url },
      })
    })
    .catch(() => {
      try {
        new Notification(title, { body, icon: "/icon.png", tag })
      } catch {}
    })
}

/** Local date YYYY-MM-DD */
export function localDateISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function tomorrowISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return localDateISO(d)
}

export function wasEventReminded(eventId: string, day: string) {
  try {
    return localStorage.getItem(`ys-event-j1:${day}:${eventId}`) === "1"
  } catch {
    return false
  }
}

export function markEventReminded(eventId: string, day: string) {
  try {
    localStorage.setItem(`ys-event-j1:${day}:${eventId}`, "1")
  } catch {}
}
