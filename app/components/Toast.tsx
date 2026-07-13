"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

type ToastType = "success" | "error" | "info"
type ToastOptions = { href?: string; duration?: number }
type ToastItem = { id: number; message: string; type: ToastType; href?: string; duration: number; leaving?: boolean }

// Fire a toast from anywhere — no hooks needed. Pass { href } to make it
// clickable (e.g. linking back to a page where a background job finished).
export function toast(message: string, type: ToastType = "success", options?: ToastOptions) {
  window.dispatchEvent(new CustomEvent("smartflavr:toast", { detail: { message, type, href: options?.href, duration: options?.duration } }))
}
toast.success = (message: string, options?: ToastOptions) => toast(message, "success", options)
toast.error = (message: string, options?: ToastOptions) => toast(message, "error", options)
toast.info = (message: string, options?: ToastOptions) => toast(message, "info", options)

let nextId = 1

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const { message, type, href, duration } = (e as CustomEvent).detail
      const id = nextId++
      const ms = duration ?? (href ? 6000 : 2600)
      setToasts(prev => [...prev.slice(-2), { id, message, type, href, duration: ms }])
      setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t)), ms)
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms + 300)
    }
    window.addEventListener("smartflavr:toast", onToast)
    return () => window.removeEventListener("smartflavr:toast", onToast)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm">
      {toasts.map(t => {
        const icon = (
          <>
            {t.type === "success" && (
              <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            )}
            {t.type === "error" && (
              <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </span>
            )}
            {t.type === "info" && (
              <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
              </span>
            )}
            <span className="leading-snug">{t.message}</span>
            {t.href && <span className="text-white/60 text-xs flex-shrink-0">View →</span>}
          </>
        )
        const className = `flex items-center gap-2.5 bg-gray-900/95 text-white text-sm font-medium rounded-full pl-3 pr-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 ${t.leaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0 animate-toast-in"} ${t.href ? "pointer-events-auto cursor-pointer hover:bg-gray-800" : ""}`
        return t.href ? (
          <Link key={t.id} href={t.href} className={className}>{icon}</Link>
        ) : (
          <div key={t.id} className={className}>{icon}</div>
        )
      })}
    </div>
  )
}
