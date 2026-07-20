"use client"
import { useEffect, useRef, useState } from "react"
import ServingsScaler from "@/app/components/ServingsScaler"
import { scaleIngredientLine } from "@/lib/scale"
import { toast } from "@/app/components/Toast"

type Timer = {
  id: number
  serverId?: number
  label: string
  recipeTitle: string
  stepIndex: number
  endsAt: number
  totalMs: number
  done: boolean
}

// A timer keeps running server-side (and will still push-notify) past this
// cap, but the UI stops offering to start more — a wall of 20 timer cards
// isn't useful to anyone.
const MAX_TIMERS = 8

type Session = {
  scale: number
  stepIndex: number
  checkedIngredients: Set<number>
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

// `recipes` is the active cooking session — usually just one, but a second
// (or third) dish can be added mid-session for when you're working on
// multiple things at once. Each recipe keeps its own step position,
// ingredient checks, and serving scale; timers are shared across the whole
// session since that's the point of tracking several dishes together.
export default function CookingMode({
  recipes: initialRecipes,
  availableRecipes = [],
  onClose,
  initialScale = 1,
}: {
  recipes: any[]
  availableRecipes?: any[]
  onClose: () => void
  initialScale?: number
}) {
  const [activeRecipes, setActiveRecipes] = useState<any[]>(initialRecipes)
  const [activeId, setActiveId] = useState<any>(initialRecipes[0]?.id ?? 0)
  const [sessions, setSessions] = useState<Record<string, Session>>(() => {
    const init: Record<string, Session> = {}
    for (const r of initialRecipes) init[String(r.id)] = { scale: initialScale, stepIndex: 0, checkedIngredients: new Set() }
    return init
  })
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [addRecipeSearch, setAddRecipeSearch] = useState("")

  const recipe = activeRecipes.find(r => String(r.id) === String(activeId)) || activeRecipes[0]
  const session = sessions[String(recipe.id)] || { scale: initialScale, stepIndex: 0, checkedIngredients: new Set<number>() }
  const { scale, stepIndex, checkedIngredients } = session

  function updateSession(patch: Partial<Session>) {
    setSessions(prev => ({ ...prev, [String(recipe.id)]: { ...prev[String(recipe.id)], ...patch } }))
  }
  function setScale(v: number) { updateSession({ scale: v }) }
  function setStepIndex(updater: number | ((prev: number) => number)) {
    updateSession({ stepIndex: typeof updater === "function" ? (updater as (p: number) => number)(session.stepIndex) : updater })
  }
  function setCheckedIngredients(next: Set<number>) {
    updateSession({ checkedIngredients: next })
  }

  const steps: string[] = (recipe.instructions || "").split("\n").filter(Boolean)
  const ingredients: string[] = (recipe.ingredients || "").split("\n").filter(Boolean).map((l: string) => scaleIngredientLine(l, scale))
  const [showIngredients, setShowIngredients] = useState(false)
  const [timers, setTimers] = useState<Timer[]>([])
  const [, setTick] = useState(0)
  const audioCtx = useRef<AudioContext | null>(null)
  const [showCustomTimer, setShowCustomTimer] = useState(false)
  const [customHours, setCustomHours] = useState("")
  const [customMinutes, setCustomMinutes] = useState("")
  const [customSeconds, setCustomSeconds] = useState("")
  const [customLabel, setCustomLabel] = useState("")

  const addCandidates = availableRecipes.filter(
    (r: any) => r.instructions && !activeRecipes.some(a => String(a.id) === String(r.id))
  )

  function addRecipeToSession(r: any) {
    setActiveRecipes(prev => [...prev, r])
    setSessions(prev => ({ ...prev, [String(r.id)]: { scale: initialScale, stepIndex: 0, checkedIngredients: new Set() } }))
    setActiveId(r.id)
    setShowAddRecipe(false)
  }

  function removeRecipeFromSession(id: any) {
    if (activeRecipes.length <= 1) return
    const remaining = activeRecipes.filter(r => r.id !== id)
    setActiveRecipes(remaining)
    if (String(activeId) === String(id)) setActiveId(remaining[0].id)
  }

  // Mobile ingredients sheet: draggable between a partial and a near-full snap point
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; moved: boolean } | null>(null)
  const SHEET_PARTIAL = 0.75
  const SHEET_FULL = 0.94

  function sheetHeightPx(expanded: boolean) {
    return (expanded ? SHEET_FULL : SHEET_PARTIAL) * window.innerHeight
  }

  function settleSheet(expanded: boolean) {
    setSheetExpanded(expanded)
    requestAnimationFrame(() => {
      if (!sheetRef.current) return
      sheetRef.current.style.transition = "height 0.25s ease-out"
      sheetRef.current.style.height = `${sheetHeightPx(expanded)}px`
    })
  }

  // Snap to the partial height, instantly, whenever the sheet is (re)opened
  useEffect(() => {
    if (!showIngredients) return
    setSheetExpanded(false)
    requestAnimationFrame(() => {
      if (!sheetRef.current) return
      sheetRef.current.style.transition = "none"
      sheetRef.current.style.height = `${sheetHeightPx(false)}px`
    })
  }, [showIngredients])

  function onHandleTouchStart(e: React.TouchEvent) {
    dragRef.current = { startY: e.touches[0].clientY, moved: false }
    if (sheetRef.current) sheetRef.current.style.transition = "none"
  }

  function onHandleTouchMove(e: React.TouchEvent) {
    if (!dragRef.current || !sheetRef.current) return
    const dy = e.touches[0].clientY - dragRef.current.startY
    if (Math.abs(dy) > 4) dragRef.current.moved = true
    const startPx = sheetHeightPx(sheetExpanded)
    const next = Math.min(sheetHeightPx(true), Math.max(60, startPx - dy))
    sheetRef.current.style.height = `${next}px`
  }

  function onHandleTouchEnd() {
    if (!dragRef.current || !sheetRef.current) return
    const { moved } = dragRef.current
    dragRef.current = null
    if (!moved) { settleSheet(!sheetExpanded); return } // tap toggles
    const currentPx = sheetRef.current.getBoundingClientRect().height
    if (currentPx < sheetHeightPx(false) * 0.5) { setShowIngredients(false); return }
    const midpoint = (sheetHeightPx(false) + sheetHeightPx(true)) / 2
    settleSheet(currentPx > midpoint)
  }

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

  // Pick up any timers that were still running server-side from a previous
  // cooking-mode session (e.g. the user closed the app and reopened it).
  useEffect(() => {
    fetch("/api/cook-timers")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const rows = data?.timers
        if (!Array.isArray(rows) || rows.length === 0) return
        const now = Date.now()
        const restored: Timer[] = rows.slice(0, MAX_TIMERS).map((row: any) => {
          const endsAt = new Date(row.ends_at).getTime()
          return {
            id: timerId++,
            serverId: row.id,
            label: row.label,
            recipeTitle: row.recipe_title || "",
            stepIndex: 0,
            endsAt,
            totalMs: Number(row.duration_ms),
            done: endsAt <= now,
          }
        })
        setTimers(prev => [...prev, ...restored])
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (timers.length >= MAX_TIMERS) {
      toast.info(`You can have up to ${MAX_TIMERS} timers running at once — dismiss one first.`)
      return
    }
    // AudioContext must be created in a user gesture to be allowed to play later
    if (!audioCtx.current) {
      try { audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {}
    }
    audioCtx.current?.resume?.()
    const localId = timerId++
    setTimers(prev => [...prev, { id: localId, label, recipeTitle: recipe.title, stepIndex, endsAt: Date.now() + ms, totalMs: ms, done: false }])
    // Persist server-side so it keeps running (and still notifies via push)
    // even if the app gets closed or backgrounded mid-cook.
    fetch("/api/cook-timers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, recipe_title: recipe.title, duration_ms: ms }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.id) return
        setTimers(prev => prev.map(t => t.id === localId ? { ...t, serverId: data.id } : t))
      })
      .catch(() => {})
  }

  function dismissTimer(id: number) {
    const t = timers.find(x => x.id === id)
    setTimers(prev => prev.filter(t => t.id !== id))
    // Cancel the server-side push too — otherwise a notification could
    // still arrive after the user already handled it in-app.
    if (t?.serverId) {
      fetch("/api/cook-timers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.serverId }),
      }).catch(() => {})
    }
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
  const isMulti = activeRecipes.length > 1
  const activeTimers = timers.filter(t => !t.done)
  const doneTimers = timers.filter(t => t.done)

  function handleFinishTap() {
    if (!isLast) { setStepIndex(i => Math.min(steps.length - 1, i + 1)); return }
    if (isMulti) { removeRecipeFromSession(recipe.id); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[90] bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-100 flex-shrink-0 gap-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{recipe.title}</p>
          <p className="text-xs text-gray-400">Step {stepIndex + 1} of {steps.length}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowCustomTimer(true)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="2" x2="14" y2="2"/></svg>
            Timer
          </button>
          <button
            onClick={() => setShowIngredients(true)}
            className="md:hidden px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition">
            Ingredients
          </button>
          <button
            onClick={() => {
              const msg = activeTimers.length > 0
                ? "Leave cooking mode? Your timers will keep running and notify you when they're done."
                : "Leave cooking mode?"
              if (confirm(msg)) onClose()
            }}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 transition" aria-label="Exit cooking mode">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Recipe tabs — only shown once you're cooking more than one thing */}
      {(isMulti || addCandidates.length > 0) && (
        <div className="flex items-center gap-2 px-4 md:px-6 py-2 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {activeRecipes.map(r => {
            const s = sessions[String(r.id)]
            const rSteps = (r.instructions || "").split("\n").filter(Boolean).length
            const active = String(r.id) === String(recipe.id)
            return (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${active ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                <span className="max-w-[8rem] truncate">{r.title}</span>
                <span className={active ? "text-orange-100" : "text-gray-400"}>{(s?.stepIndex ?? 0) + 1}/{rSteps || 1}</span>
                {isMulti && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); removeRecipeFromSession(r.id) }}
                    className={active ? "text-orange-100 hover:text-white" : "text-gray-300 hover:text-red-400"}>
                    ✕
                  </span>
                )}
              </button>
            )
          })}
          {addCandidates.length > 0 && (
            <button
              onClick={() => setShowAddRecipe(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 transition flex-shrink-0">
              + Cook another
            </button>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 flex-shrink-0">
        <div className="h-1 bg-orange-500 transition-all duration-300" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
      </div>

      {/* Body: desktop gets a persistent sidebar; mobile keeps the single-column flow */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar — ingredients + step overview */}
        <div className="hidden md:flex md:flex-col w-80 lg:w-96 border-r border-gray-100 bg-gray-50/60 flex-shrink-0 overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ingredients</p>
              <ServingsScaler servings={recipe.servings} factor={scale} onChange={setScale} />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-1">
              {ingredients.length === 0 && <p className="text-sm text-gray-300 py-3">No ingredients listed.</p>}
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
            {new RegExp(DURATION_RE.source, "i").test(steps[stepIndex] || "") && (
              <p className="text-xs text-orange-400 mt-3 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="2" x2="14" y2="2"/></svg>
                Tap a highlighted time to start a timer
              </p>
            )}
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
        <div className="px-4 pb-2 space-y-2 flex-shrink-0 max-h-[30vh] overflow-y-auto">
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
                  <span className="block text-sm font-bold truncate">{t.label} — done!{isMulti ? ` (${t.recipeTitle})` : ""}</span>
                  <span className="block text-xs text-white/80">Tap to stop the alarm</span>
                </span>
              </span>
              <span className="text-xs font-semibold bg-white/20 rounded-full px-3 py-1.5 flex-shrink-0">Dismiss</span>
            </button>
          ))}
        </div>
      )}

      {/* Running timers — countdown cards with progress, wrapping onto new
          rows instead of scrolling horizontally so a growing timer count
          never pushes past the edge of the screen */}
      {activeTimers.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2.5 flex-shrink-0 max-h-[30vh] overflow-y-auto">
          {activeTimers.map(t => {
            const remaining = t.endsAt - Date.now()
            const pct = Math.max(0, Math.min(100, (remaining / t.totalMs) * 100))
            return (
              <div key={t.id} className="relative bg-white border border-gray-200 rounded-2xl px-4 py-3 w-[calc(50%-0.3125rem)] sm:w-[150px] flex-shrink-0 overflow-hidden shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-2xl font-bold tabular-nums leading-tight text-orange-500">{formatCountdown(remaining)}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5 max-w-36">{t.label}{isMulti ? ` · ${t.recipeTitle}` : ""}</div>
                  </div>
                  <button
                    onClick={() => dismissTimer(t.id)}
                    aria-label="Cancel timer"
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 text-sm flex items-center justify-center hover:bg-gray-200 hover:text-gray-600 flex-shrink-0 -mr-1 -mt-0.5 transition">
                    ✕
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
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
            onClick={handleFinishTap}
            className={`flex-[2] py-3.5 rounded-2xl text-sm font-semibold text-white transition ${isLast ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"}`}>
            {isLast ? (isMulti ? "✓ Done with this one" : "✓ Finish cooking") : "Next step →"}
          </button>
        </div>
      </div>

      {/* Ingredients sheet — drag the handle up for a near-full view, down to shrink or dismiss */}
      {showIngredients && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end" onClick={() => setShowIngredients(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div ref={sheetRef} className="relative bg-white rounded-t-3xl h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div
              onTouchStart={onHandleTouchStart}
              onTouchMove={onHandleTouchMove}
              onTouchEnd={onHandleTouchEnd}
              className="pt-2.5 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none">
              <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto" />
            </div>
            <div className="flex items-center justify-between gap-2 px-5 pb-4 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-semibold flex-shrink-0">Ingredients</p>
              <ServingsScaler servings={recipe.servings} factor={scale} onChange={setScale} />
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

      {/* Custom timer */}
      {showCustomTimer && (() => {
        const h = parseFloat(customHours) || 0
        const m = parseFloat(customMinutes) || 0
        const s = parseFloat(customSeconds) || 0
        const totalMs = (h * 3600 + m * 60 + s) * 1000
        const defaultLabel = [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(" ") || "Timer"
        const submit = () => {
          if (totalMs <= 0) return
          startTimer(customLabel.trim() || defaultLabel, totalMs)
          setShowCustomTimer(false); setCustomHours(""); setCustomMinutes(""); setCustomSeconds(""); setCustomLabel("")
        }
        return (
          <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center px-4" onClick={() => setShowCustomTimer(false)}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-gray-900 mb-4">Set a timer</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[1, 5, 10, 15, 20, 30].map(preset => (
                  <button
                    key={preset}
                    onClick={() => { setCustomHours(""); setCustomMinutes(String(preset)); setCustomSeconds("") }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${customMinutes === String(preset) && !customHours && !customSeconds ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {preset}m
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Hours</label>
                  <input
                    type="number" inputMode="numeric" min={0}
                    value={customHours}
                    onChange={e => setCustomHours(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Minutes</label>
                  <input
                    type="number" inputMode="numeric" min={0}
                    value={customMinutes}
                    onChange={e => setCustomMinutes(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Seconds</label>
                  <input
                    type="number" inputMode="numeric" min={0}
                    value={customSeconds}
                    onChange={e => setCustomSeconds(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <label className="text-xs text-gray-500 mb-1 block">Label <span className="text-gray-300">(optional)</span></label>
              <input
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="e.g. resting dough"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowCustomTimer(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                <button
                  onClick={submit}
                  disabled={totalMs <= 0}
                  className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition">
                  Start
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add another recipe to this session */}
      {showAddRecipe && (() => {
        const q = addRecipeSearch.trim().toLowerCase()
        const filtered = q ? addCandidates.filter((r: any) => r.title?.toLowerCase().includes(q)) : addCandidates
        return (
          <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center px-4" onClick={() => { setShowAddRecipe(false); setAddRecipeSearch("") }}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-gray-900 mb-1">Cook another recipe too</p>
              <p className="text-xs text-gray-400 mb-3">Keep working on {recipe.title} — its progress is saved.</p>
              {addCandidates.length > 5 && (
                <input
                  value={addRecipeSearch}
                  onChange={e => setAddRecipeSearch(e.target.value)}
                  placeholder="Search recipes..."
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-3"
                />
              )}
              <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5">
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-300 text-center py-6">{q ? `Nothing matches "${addRecipeSearch}"` : "No other recipes in this cookbook."}</p>
                )}
                {filtered.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => { addRecipeToSession(r); setAddRecipeSearch("") }}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-100 hover:bg-orange-50 hover:border-orange-200 transition text-sm text-gray-700">
                    {r.title}
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowAddRecipe(false); setAddRecipeSearch("") }} className="mt-4 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition">Cancel</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
