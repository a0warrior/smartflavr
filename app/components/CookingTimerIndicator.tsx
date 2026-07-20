"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ClockIcon } from "@/app/components/Icons"

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
// tab (or another part of the app) doesn't mean losing track of it.
// Naturally hidden while actually inside Cooking Mode since that overlay
// renders at a higher z-index on top of it.
export default function CookingTimerIndicator() {
  const { status } = useSession()
  const router = useRouter()
  const [timers, setTimers] = useState<CookTimer[]>([])
  const [, setTick] = useState(0)

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    function poll() {
      fetch("/api/cook-timers")
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (!cancelled && Array.isArray(data?.timers)) setTimers(data.timers) })
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

  if (timers.length === 0) return null

  const soonest = [...timers].sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime())[0]
  const remaining = new Date(soonest.ends_at).getTime() - Date.now()

  function resume() {
    if (soonest.cookbook_id && soonest.recipe_id) {
      const step = typeof soonest.step_index === "number" ? `&resumeStep=${soonest.step_index}` : ""
      router.push(`/cookbook/${soonest.cookbook_id}?recipe=${soonest.recipe_id}&resumeCooking=1${step}`)
    }
  }

  return (
    <button
      onClick={resume}
      className="fixed z-40 bottom-20 md:bottom-5 right-4 md:right-5 bg-gray-900 text-white rounded-full pl-3 pr-4 py-2.5 shadow-xl flex items-center gap-2.5 hover:bg-gray-800 active:scale-95 transition">
      <span className="relative flex-shrink-0">
        <ClockIcon size={16} className="text-orange-400" />
      </span>
      <span className="text-left">
        <span className="block text-sm font-bold tabular-nums leading-tight">{formatRemaining(remaining)}</span>
        <span className="block text-[10px] text-gray-400 truncate max-w-[9rem] leading-tight">
          {soonest.label}{timers.length > 1 ? ` · +${timers.length - 1} more` : ""}
        </span>
      </span>
    </button>
  )
}
