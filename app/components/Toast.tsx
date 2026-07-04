"use client"
import { useEffect, useState } from "react"

type ToastType = "success" | "error" | "info"
type ToastItem = { id: number; message: string; type: ToastType; leaving?: boolean }

// Fire a toast from anywhere — no hooks needed.
export function toast(message: string, type: ToastType = "success") {
  window.dispatchEvent(new CustomEvent("smartflavr:toast", { detail: { message, type } }))
}
toast.success = (message: string) => toast(message, "success")
toast.error = (message: string) => toast(message, "error")
toast.info = (message: string) => toast(message, "info")

let nextId = 1

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const { message, type } = (e as CustomEvent).detail
      const id = nextId++
      setToasts(prev => [...prev.slice(-2), { id, message, type }])
      setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t)), 2600)
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2900)
    }
    window.addEventListener("smartflavr:toast", onToast)
    return () => window.removeEventListener("smartflavr:toast", onToast)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 bg-gray-900/95 text-white text-sm font-medium rounded-full pl-3 pr-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 ${t.leaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0 animate-toast-in"}`}>
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
        </div>
      ))}
    </div>
  )
}
