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

    function ping() {
      if (document.visibilityState !== "visible") return
      fetch("/api/presence", { method: "POST" }).catch(() => {})
    }

    ping()
    const interval = setInterval(ping, INTERVAL_MS)
    document.addEventListener("visibilitychange", ping)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", ping)
    }
  }, [status])

  return null
}
