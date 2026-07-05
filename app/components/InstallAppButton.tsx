"use client"
import { useEffect, useState } from "react"

// "Add to home screen" shortcut. On Android/Chrome we trigger the native
// install prompt; on iOS (no API for this) we show quick instructions.
export default function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true) // assume installed until we know otherwise
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true
    setIsStandalone(standalone)
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent))
    function onPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])

  if (isStandalone) return null
  if (!deferredPrompt && !isIOS) return null

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    } else {
      setShowIOSHelp(true)
    }
  }

  return (
    <>
      <button
        onClick={install}
        className={className || "inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>
        Get the app
      </button>

      {showIOSHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4" onClick={() => setShowIOSHelp(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-medium mb-1">Add SmartFlavr to your home screen</h2>
            <p className="text-sm text-gray-400 mb-5">It installs like an app — icon, full screen, no browser bar.</p>
            <ol className="space-y-4 mb-6">
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                <span className="flex items-center gap-1.5 flex-wrap">Tap the <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-blue-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span> Share button in Safari</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                <span>Scroll down and tap <span className="font-semibold">"Add to Home Screen"</span></span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                <span>Tap <span className="font-semibold">Add</span> — done!</span>
              </li>
            </ol>
            <button onClick={() => setShowIOSHelp(false)} className="w-full border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">Got it</button>
          </div>
        </div>
      )}
    </>
  )
}
