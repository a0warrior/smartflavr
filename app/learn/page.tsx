"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LearnPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tracks, setTracks] = useState<any[]>([])
  const [streak, setStreak] = useState<any>({ current_streak: 0, total_xp: 0 })
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") fetchData()
  }, [status])

  async function fetchData() {
    setLoading(true)
    const res = await fetch("/api/learn")
    const data = await res.json()
    setTracks(data.tracks || [])
    setStreak(data.streak || { current_streak: 0, total_xp: 0 })
    setCompletedIds(new Set(data.completedLessonIds || []))
    setLoading(false)
  }

  const activeTrack = tracks.find(t => t.completedCount > 0 && t.completedCount < t.totalCount)
  const nextLesson = activeTrack?.lessons?.find((l: any) => !completedIds.has(l.id))

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition">← Back to SmartFlavr</Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🔥</span>
            <span className="text-sm font-medium text-orange-500">{streak.current_streak} day streak</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">⭐</span>
            <span className="text-sm font-medium text-gray-700">{streak.total_xp} XP</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Learn to cook</h1>
          <p className="text-gray-400 text-sm">Bite-sized lessons to make you a better cook — one skill at a time.</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <div className="text-2xl font-medium text-orange-500">{streak.current_streak} 🔥</div>
            <div className="text-xs text-gray-400 mt-1">Day streak</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <div className="text-2xl font-medium text-gray-900">{streak.total_xp}</div>
            <div className="text-xs text-gray-400 mt-1">Total XP</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <div className="text-2xl font-medium text-gray-900">{tracks.filter(t => t.completedCount === t.totalCount && t.totalCount > 0).length}</div>
            <div className="text-xs text-gray-400 mt-1">Tracks completed</div>
          </div>
        </div>

        {activeTrack && nextLesson && (
          <div className="bg-orange-500 rounded-2xl p-5 mb-8 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-orange-100 font-medium mb-1">Continue where you left off</div>
              <div className="text-white font-medium text-base">{nextLesson.title}</div>
              <div className="text-orange-100 text-sm mt-0.5">{activeTrack.emoji} {activeTrack.name} · Lesson {activeTrack.completedCount + 1} of {activeTrack.totalCount}</div>
            </div>
            <Link
              href={`/learn/${activeTrack.slug}/${nextLesson.id}`}
              className="bg-white text-orange-500 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-50 transition whitespace-nowrap flex-shrink-0">
              Continue →
            </Link>
          </div>
        )}

        <h2 className="text-base font-medium text-gray-900 mb-4">All skill tracks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tracks.map((track: any) => {
            const pct = track.totalCount > 0 ? Math.round((track.completedCount / track.totalCount) * 100) : 0
            const isDone = track.completedCount === track.totalCount && track.totalCount > 0
            const isStarted = track.completedCount > 0 && !isDone
            return (
              <Link
                key={track.id}
                href={`/learn/${track.slug}`}
                className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-sm transition group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{track.emoji}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{track.name}</div>
                      <div className="text-xs text-gray-400">{track.totalCount} lessons · {track.difficulty}</div>
                    </div>
                  </div>
                  {isDone && <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700">Done ✓</span>}
                  {isStarted && <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600">In progress</span>}
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${isDone ? "bg-green-500" : "bg-orange-400"}`}
                    style={{ width: `${pct}%` }}/>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{track.completedCount} of {track.totalCount} done</span>
                  <span className="text-xs text-orange-500 opacity-0 group-hover:opacity-100 transition">Start →</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}