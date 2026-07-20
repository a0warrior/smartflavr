// Minimal service worker whose only job is push notifications — this app
// doesn't do offline caching, so there's nothing else here.

self.addEventListener("push", event => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: "SmartFlavr", body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(payload.title || "SmartFlavr", {
      body: payload.body || "",
      icon: "/icon-192-v2.png",
      badge: "/icon-192-v2.png",
      data: { url: payload.url || "/dashboard" },
    })
  )
})

self.addEventListener("notificationclick", event => {
  event.notification.close()
  const url = event.notification.data?.url || "/dashboard"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
