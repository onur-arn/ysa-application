/** Sync unread indicator on the bottom-nav Mesajlar icon across the app. */

export const NAV_UNREAD_KEY = "ys-nav-unread"
export const NAV_UNREAD_EVENT = "ys-nav-unread"

export function getNavUnread(): boolean {
  try {
    return localStorage.getItem(NAV_UNREAD_KEY) === "1"
  } catch {
    return false
  }
}

export function setNavUnread(hasUnread: boolean) {
  try {
    localStorage.setItem(NAV_UNREAD_KEY, hasUnread ? "1" : "0")
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NAV_UNREAD_EVENT, { detail: { hasUnread } }))
  }
}

/** Mark a conversation as read up to `at` (ISO). Own sends should call this too. */
export function markConversationRead(conversationId: string, at = new Date().toISOString()) {
  try {
    const lastRead: Record<string, string> = JSON.parse(localStorage.getItem("ys-last-read") ?? "{}")
    const prev = lastRead[conversationId]
    if (!prev || at > prev) {
      lastRead[conversationId] = at
      localStorage.setItem("ys-last-read", JSON.stringify(lastRead))
    }
  } catch {}
}

/**
 * Recompute badge from per-conversation unread counts only.
 * Never treat "last activity is mine" as unread.
 */
export function refreshNavUnreadFromStorage(
  items: Array<{ id: string; lastAt?: string; unread?: number }>,
) {
  try {
    const has = items.some((item) => (item.unread ?? 0) > 0)
    setNavUnread(has)
    return has
  } catch {
    return getNavUnread()
  }
}

export function isSameSender(a?: string | null, b?: string | null) {
  return (a ?? "").trim() === (b ?? "").trim()
}
