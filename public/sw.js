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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
      // Reuse an already-open tab instead of opening a new one — matching
      // on the full URL (including query string) almost never hit, so this
      // used to open a duplicate tab nearly every time. That second tab ran
      // its own independent timer/alarm logic, so dismissing the alarm in
      // the tab you were looking at didn't touch the other one, which kept
      // ringing until you actually closed it.
      const existing = clients[0]
      if (existing) {
        await existing.focus()
        // Deliberately NOT WindowClient.navigate() here — a service-worker
        // -driven navigation of an already-open document isn't reliably
        // treated as a top-level user navigation for SameSite=Lax cookie
        // purposes in every browser, which was dropping the session cookie
        // and signing people out. Posting a message and letting the
        // already-authenticated page navigate itself via its own router
        // sidesteps that entirely — it's just a normal in-app transition.
        existing.postMessage({ type: "NAVIGATE", url })
        return existing
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
