self.addEventListener("push", (event) => {
  if (!event.data) return
  let data
  try {
    data = event.data.json()
  } catch {
    return
  }
  const isCall = data.kind === "call" || (typeof data.tag === "string" && data.tag.startsWith("call-"))
  event.waitUntil(
    self.registration.showNotification(data.title || "YSA", {
      body: data.body,
      icon: "/icon.png",
      badge: "/icon.png",
      tag: data.tag ?? (isCall ? `call-${Date.now()}` : undefined),
      renotify: isCall,
      requireInteraction: isCall || !!data.requireInteraction,
      vibrate: isCall ? [300, 100, 300, 100, 300] : [100, 50, 100],
      data: { url: data.url ?? "/feed", kind: data.kind ?? null },
      actions: isCall
        ? [
            { action: "answer", title: "Yanıtla" },
            { action: "dismiss", title: "Kapat" },
          ]
        : undefined,
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  const action = event.action
  if (action === "dismiss") {
    event.notification.close()
    return
  }
  event.notification.close()
  const url = event.notification.data?.url ?? "/feed"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    }),
  )
})
