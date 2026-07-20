"use client"
import { useEffect } from "react"

// Every modal/overlay in the app is built the same way: a `fixed inset-0`
// backdrop div rendered conditionally into the page. Rather than wiring a
// scroll-lock hook into each of the ~30 call sites individually, watch the
// DOM for that pattern and lock/unlock body scroll whenever one is present —
// this covers every current and future modal built the same way.
//
// One structural element matches the raw selector but is always mounted
// (Navbar's mobile-sidebar backdrop, faded via opacity/pointer-events
// instead of being conditionally rendered) — so visibility must be checked
// via computed style, not just class presence, or scroll would stay locked
// on every page permanently.
const OVERLAY_SELECTOR = '[class*="fixed"][class*="inset-0"]'

function isVisibleOverlay(el: Element) {
  const style = getComputedStyle(el)
  return style.display !== "none" && style.pointerEvents !== "none" && parseFloat(style.opacity) > 0
}

export default function ModalScrollLock() {
  useEffect(() => {
    let locked = false

    function sync() {
      const candidates = document.body.querySelectorAll(OVERLAY_SELECTOR)
      const hasOverlay = Array.from(candidates).some(isVisibleOverlay)
      if (hasOverlay === locked) return
      locked = hasOverlay
      document.body.style.overflow = hasOverlay ? "hidden" : ""
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      document.body.style.overflow = ""
    }
  }, [])

  return null
}
