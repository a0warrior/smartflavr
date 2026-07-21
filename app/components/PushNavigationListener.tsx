"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Tapping a push notification focuses the existing tab (see public/sw.js)
// and posts the target URL here instead of navigating the document
// directly from the service worker — router.push() runs as a normal
// client-side transition on the already-signed-in page, avoiding the
// cookie issues a service-worker-driven navigation risked.
export default function PushNavigationListener() {
  const router = useRouter()

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "NAVIGATE" && typeof event.data.url === "string") {
        router.push(event.data.url)
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [router])

  return null
}
