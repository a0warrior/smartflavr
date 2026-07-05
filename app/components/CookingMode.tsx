"use client"
import { useEffect, useRef, useState } from "react"

type Timer = {
  id: number
  label: string
  stepIndex: number
  endsAt: number
  totalMs: number
  done: boolean
}

// Matches durations like "25 minutes", "1 hour", "20-25 mins", "30 sec"
const DURATION_RE = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi

function unitToMs(unit: string) {
  const u = unit.toLowerCase()
  if (u.startsWith("h")) return 3600_000
  if (u.startsWith("m")) return 60_000
  return 1000
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

let timerId = 1

export default function CookingMode({ recipe, onClose }: { recipe: any, onClose: () => void }) {
  const steps: string[] = (recipe.instructions || "").split("\n").filter(Boolean)
  const ingredients: string[] = (recipe.ingredients || "").split("\n").filter(Boolean)
  const [stepIndex, setStepIndex] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set())
  const [timers, setTimers] = useState<Timer[]>([])
  const [, setTick] = useState(0)
  const audioCtx = useRef<AudioContext | null>(null)

  // Keep the screen awake while cooking
  useEffect(() => {
    let lock: any = null
    let released = false
    async function acquire() {
      try {
        lock = await (navigator as any).wakeLock?.request("screen")
      } catch {}
    }
    function onVisibility() {
      if (document.visibilityState === "visible" && !released) acquire()
    }
    acquire()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      released = true
      document.removeEventListener("visibilitychange", onVisibility)
      lock?.release?.().catch?.(() => {})
    }
  }, [])

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  // Tick every second while timers run; fire alerts on completion
  useEffect(() => {
    if (timers.length === 0) return
    const interval = setInterval(() => {
      setTick(t => t + 1)
      const now = Date.now()
      setTimers(prev => prev.map(t => (!t.done && now >= t.endsAt) ? { ...t, done: true } : t))
    }, 500)
    return () => clearInterval(interval)
  }, [timers.length])

  // Ring repeatedly while any finished timer is still on screen
  const hasDoneTimer = timers.some(t => t.done)
  useEffect(() => {
    if (!hasDoneTimer) return
    ringAlarm()
    const interval = setInterval(ringAlarm, 1800)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDoneTimer])

  function ringAlarm() {
    try { (navigator as any).vibrate?.([300, 120, 300, 120, 300]) } catch {}
    try {
      const ctx = audioCtx.current
      if (!ctx) return
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.45)
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + i * 0.45 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.45 + 0.35)
        osc.connect(gain).connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.45)
        osc.stop(ctx.currentTime + i * 0.45 + 0.4)
      }
    } catch {}
  }

  function startTimer(label: string, ms: number) {
    // AudioContext must be created in a user gesture to be allowed to play later
    if (!audioCtx.current) {
      try { audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {}
    }
    audioCtx.current?.resume?.()
    setTimers(prev => [...prev, { id: timerId++, label, stepIndex, endsAt: Date.now() + ms, totalMs: ms, done: false }])
  }

  function dismissTimer(id: number) {
    setTimers(prev => prev.filter(t => t.id !== id))
  }

  // Render a step's text with durations as tappable timer buttons
  function renderStepText(text: string) {
    const parts: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    const re = new RegExp(DURATION_RE.source, "gi")
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index))
      const value = parseFloat(m[1])
      const ms = value * unitToMs(m[3])
      const label = m[0]
      parts.push(
        <button
          key={`${m.index}-${label}`}
          onClick={() => startTimer(label, ms)}
          className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-lg font-semibold whitespace-nowrap active:bg-orange-200 transition align-baseline">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="2" x2="14" y2="2"/></svg>
          {label}
        </button>
      )
      last = m.index + m[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
  }

  const isLast = stepIndex === steps.length - 1
  const activeTimers = timers.filter(t => !t.done)
  const doneTimers = timers.filter(t => t.done)

  return (
    <div className="fixed inset-0 z-[90] bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-100 flex-shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{recipe.title}</p>
          <p className="text-xs text-gray-400">Step {stepIndex + 1} of {steps.length}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowIngredients(true)}
            className="md:hidden px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition">
            Ingredients
          </button>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 transition" aria-label="Exit cooking mode">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 flex-shrink-0">
        <div className="h-1 bg-orange-500 transition-all duration-300" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
      </div>

      {/* Body: desktop gets a persistent sidebar; mobile keeps the single-column flow */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar — ingredients + step overview */}
        <div className="hidden md:flex md:flex-col w-80 lg:w-96 border-r border-gray-100 bg-gray-50/60 flex-shrink-0 overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ingredients</p>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-1">
              {ingredients.map((ing, i) => (
                <label key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedIngredients.has(i)}
                    onChange={() => {
                      const next = new Set(checkedIngredients)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      setCheckedIngredients(next)
                    }}
                    className="w-4 h-4 accent-orange-500 flex-shrink-0"
                  />
                  <span className={`text-sm ${checkedIngredients.has(i) ? "text-gray-300 line-through" : "text-gray-700"}`}>{ing}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="px-5 pt-2 pb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Steps</p>
            <div className="space-y-1">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStepIndex(i)}
                  className={`w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl text-xs transition ${i === stepIndex ? "bg-orange-500 text-white" : i < stepIndex ? "text-gray-300 hover:bg-white" : "text-gray-500 hover:bg-white"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${i === stepIndex ? "bg-white/25" : i < stepIndex ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {i < stepIndex ? "✓" : i + 1}
                  </span>
                  <span className="line-clamp-2 leading-snug pt-0.5">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-8 flex items-start md:items-center justify-center">
          <div className="max-w-2xl w-full">
            <div className="w-10 h-10 rounded-full bg-orange-500 text-white text-base font-bold flex items-center justify-center mb-5">{stepIndex + 1}</div>
            <p className="text-2xl md:text-3xl leading-relaxed md:leading-relaxed text-gray-900 font-medium">
              {renderStepText(steps[stepIndex] || "")}
            </p>
            {steps[stepIndex + 1] && (
              <p className="text-sm text-gray-300 mt-8 leading-relaxed">
                <span className="font-semibold uppercase text-[10px] tracking-wide">Up next: </span>
                {steps[stepIndex + 1]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Finished timers — full-width alarm banner */}
      {doneTimers.length > 0 && (
        <div className="px-4 pb-2 space-y-2 flex-shrink-0">
          {doneTimers.map(t => (
            <button
              key={t.id}
              onClick={() => dismissTimer(t.id)}
              className="w-full flex items-center justify-between bg-green-500 text-white rounded-2xl px-5 py-4 animate-pulse active:scale-[0.99] transition">
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </span>
                <span className="text-left min-w-0">
                  <span className="block text-sm font-bold truncate">{t.label} — done!</span>
                  <span className="block text-xs text-white/80">Tap to stop the alarm</span>
                </span>
              </span>
              <span className="text-xs font-semibold bg-white/20 rounded-full px-3 py-1.5 flex-shrink-0">Dismiss</span>
            </button>
          ))}
        </div>
      )}

      {/* Running timers — countdown cards with progress */}
      {activeTimers.length > 0 && (
        <div className="px-4 pb-2 flex gap-2.5 overflow-x-auto flex-shrink-0">
          {activeTimers.map(t => {
            const remaining = t.endsAt - Date.now()
            const pct = Math.max(0, Math.min(100, (remaining / t.totalMs) * 100))
            return (
              <div key={t.id} className="relative bg-gray-900 text-white rounded-2xl px-4 py-3 min-w-[150px] flex-shrink-0 overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-2xl font-bold tabular-nums leading-tight">{formatCountdown(remaining)}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5 max-w-36">{t.label}</div>
                  </div>
                  <button
                    onClick={() => dismissTimer(t.id)}
                    aria-label="Cancel timer"
                    className="w-7 h-7 rounded-full bg-white/10 text-gray-300 text-sm flex items-center justify-center hover:bg-white/20 flex-shrink-0 -mr-1 -mt-0.5">
                    ✕
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div className="h-1 bg-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Navigation */}
      <div className="px-4 md:px-6 py-4 border-t border-gray-100 flex-shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setStepIndex(i => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
            ← Back
          </button>
          <button
            onClick={() => isLast ? onClose() : setStepIndex(i => Math.min(steps.length - 1, i + 1))}
            className={`flex-[2] py-3.5 rounded-2xl text-sm font-semibold text-white transition ${isLast ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"}`}>
            {isLast ? "✓ Finish cooking" : "Next step →"}
          </button>
        </div>
      </div>

      {/* Ingredients sheet */}
      {showIngredients && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end" onClick={() => setShowIngredients(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-3xl max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-semibold">Ingredients</p>
              <button onClick={() => setShowIngredients(false)} className="text-gray-400 p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              {ingredients.map((ing, i) => (
                <label key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedIngredients.has(i)}
                    onChange={() => {
                      const next = new Set(checkedIngredients)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      setCheckedIngredients(next)
                    }}
                    className="w-4 h-4 accent-orange-500 flex-shrink-0"
                  />
                  <span className={`text-sm ${checkedIngredients.has(i) ? "text-gray-300 line-through" : "text-gray-700"}`}>{ing}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
