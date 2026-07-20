"use client"
import { useEffect } from "react"
import { useSession } from "next-auth/react"

const INTERVAL_MS = 25_000

// Pings while the tab is visible so the server knows the user is actively
// looking at the app right now — sendPush() uses this to skip a push
// notification when the in-app UI would already show the same update.
export default function PresenceHeartbeat() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== "authenticated") return

    function markActive() {
      fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) }).catch(() => {})
    }
    function markInactive() {
      // keepalive so this still lands even as the tab is unloading/backgrounding
      fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: false }), keepalive: true }).catch(() => {})
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") markActive()
      else markInactive()
    }

    if (document.visibilityState === "visible") markActive()
    const interval = setInterval(() => { if (document.visibilityState === "visible") markActive() }, INTERVAL_MS)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", markInactive)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", markInactive)
    }
  }, [status])

  return null
}
