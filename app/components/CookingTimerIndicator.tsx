"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ClockIcon, CheckIcon } from "@/app/components/Icons"
import { useCookingModeStatus } from "@/app/components/CookingModeStatus"

type CookTimer = {
  id: number
  label: string
  recipe_title: string | null
  cookbook_id: number | null
  recipe_id: number | null
  step_index: number | null
  ends_at: string
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

// A small floating pill, visible on any page, showing the soonest-to-finish
// cooking timer — so leaving cooking mode to grab something from another
// tab (or another part of the app) doesn't mean losing track of it. Turns
// green with an alert tone once that timer hits zero, and stays up (rather
// than silently disappearing) until the user taps back in or dismisses it.
// Suppressed while Cooking Mode itself is open, since that has its own
// alarm and this would otherwise double it up.
export default function CookingTimerIndicator() {
  const { status } = useSession()
  const router = useRouter()
  const { active: inCookingMode } = useCookingModeStatus()
  const [timers, setTimers] = useState<CookTimer[]>([])
  const [, setTick] = useState(0)
  const audioCtx = useRef<AudioContext | null>(null)
  const wasDoneRef = useRef(false)
  // Dismissing filters timers out client-side immediately rather than only
  // waiting on the server DELETE + next 15s poll — otherwise a dismissed
  // timer could get resurrected by a poll that lands before the delete has
  // taken effect, which is what made the alarm look like it "kept playing
  // after dismiss."
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())

  // Web Audio requires its context to be created/resumed during a genuine
  // user gesture before it's allowed to play sound later — unlock it on
  // the first tap/click anywhere in the app so it's ready by the time a
  // timer actually finishes (which happens on its own, not from a click).
  // iOS Safari in particular won't reliably unlock from resume() alone —
  // it needs an actual (silent) sound played within the gesture too.
  useEffect(() => {
    function unlock() {
      if (!audioCtx.current) {
        try { audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {}
      }
      const ctx = audioCtx.current
      if (!ctx) return
      ctx.resume?.()
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.value = 0.00001
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.05)
      } catch {}
    }
    document.addEventListener("pointerdown", unlock)
    return () => document.removeEventListener("pointerdown", unlock)
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    function poll() {
      fetch("/api/cook-timers")
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (cancelled || !Array.isArray(data?.timers)) return
          setTimers(data.timers)
          // Once a dismissed timer actually drops out of the server list,
          // stop tracking it — keeps the set from growing unbounded.
          const liveIds = new Set(data.timers.map((t: CookTimer) => t.id))
          setDismissedIds(prev => {
            const next = new Set([...prev].filter(id => liveIds.has(id)))
            return next.size === prev.size ? prev : next
          })
        })
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 15_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [status])

  // Live countdown between polls
  useEffect(() => {
    if (timers.length === 0) return
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [timers.length])

  const visibleTimers = timers.filter(t => !dismissedIds.has(t.id))
  const soonest = visibleTimers.length > 0
    ? [...visibleTimers].sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime())[0]
    : null
  const remaining = soonest ? new Date(soonest.ends_at).getTime() - Date.now() : 0
  const isDone = !!soonest && remaining <= 0

  function ring() {
    try { (navigator as any).vibrate?.([250, 100, 250]) } catch {}
    try {
      const ctx = audioCtx.current
      if (!ctx) return
      ctx.resume?.() // iOS suspends the context when the tab backgrounds/foregrounds
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch {}
  }

  // Ring once right when a timer flips to done, then keep a slow repeat
  // going for as long as it's sitting there unacknowledged.
  useEffect(() => {
    if (inCookingMode) return
    if (!isDone) { wasDoneRef.current = false; return }
    if (!wasDoneRef.current) { wasDoneRef.current = true; ring() }
    const interval = setInterval(ring, 4000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, inCookingMode])

  if (inCookingMode || !soonest) return null

  function resume() {
    if (soonest!.cookbook_id && soonest!.recipe_id) {
      const step = typeof soonest!.step_index === "number" ? `&resumeStep=${soonest!.step_index}` : ""
      router.push(`/cookbook/${soonest!.cookbook_id}?recipe=${soonest!.recipe_id}&resumeCooking=1${step}`)
    }
  }

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation()
    const id = soonest!.id
    setDismissedIds(prev => new Set(prev).add(id))
    fetch("/api/cook-timers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  return (
    <div
      onClick={resume}
      className={`fixed z-40 bottom-20 md:bottom-5 right-4 md:right-5 min-w-[11rem] rounded-full pl-3 pr-2 py-2.5 shadow-xl flex items-center gap-2.5 cursor-pointer active:scale-95 transition ${
        isDone ? "bg-green-600 hover:bg-green-500" : "bg-gray-900 hover:bg-gray-800"
      }`}>
      <span className="flex-shrink-0 flex items-center justify-center w-7 h-7">
        {isDone ? (
          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <CheckIcon size={13} className="text-white" />
          </span>
        ) : (
          <ClockIcon size={16} className="text-orange-400" />
        )}
      </span>
      <span className="text-left flex-1 min-w-0">
        <span className="block text-sm font-bold tabular-nums leading-tight text-white">
          {isDone ? "Timer done!" : formatRemaining(remaining)}
        </span>
        <span className={`block text-[10px] truncate leading-tight ${isDone ? "text-green-100" : "text-gray-400"}`}>
          {soonest.label}{visibleTimers.length > 1 ? ` · +${visibleTimers.length - 1} more` : ""}
        </span>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}
