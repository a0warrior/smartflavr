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
  const notifiedTimers = useRef<Set<number>>(new Set())

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
      setTimers(prev => prev.map(t => {
        if (!t.done && now >= t.endsAt) {
          if (!notifiedTimers.current.has(t.id)) {
            notifiedTimers.current.add(t.id)
            ringAlarm()
          }
          return { ...t, done: true }
        }
        return t
      }))
    }, 500)
    return () => clearInterval(interval)
  }, [timers.length])

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
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition">
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

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-8 flex items-start md:items-center justify-center">
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

      {/* Running timers */}
      {(activeTimers.length > 0 || doneTimers.length > 0) && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
          {doneTimers.map(t => (
            <button
              key={t.id}
              onClick={() => dismissTimer(t.id)}
              className="flex items-center gap-2 pl-3 pr-2.5 py-2 bg-green-500 text-white rounded-full text-sm font-semibold whitespace-nowrap animate-pulse">
              ✓ {t.label} done
              <span className="text-white/70 text-xs">tap to dismiss</span>
            </button>
          ))}
          {activeTimers.map(t => (
            <div key={t.id} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-gray-900 text-white rounded-full text-sm whitespace-nowrap">
              <span className="font-mono font-semibold tabular-nums">{formatCountdown(t.endsAt - Date.now())}</span>
              <span className="text-gray-400 text-xs max-w-28 truncate">{t.label}</span>
              <button onClick={() => dismissTimer(t.id)} className="w-5 h-5 rounded-full bg-white/10 text-gray-300 text-xs flex items-center justify-center hover:bg-white/20">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 px-4 md:px-6 py-4 border-t border-gray-100 flex-shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
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
