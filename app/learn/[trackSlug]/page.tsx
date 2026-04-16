"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"

export default function TrackPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const [track, setTrack] = useState<any>(null)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set())
  const [streak, setStreak] = useState<any>({ current_streak: 0, total_xp: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") fetchData()
  }, [status])

  async function fetchData() {
    setLoading(true)
    const res = await fetch("/api/learn")
    const data = await res.json()
    const found = (data.tracks || []).find((t: any) => t.slug === params.trackSlug)
    if (!found) { router.push("/learn"); return }
    setTrack(found)
    setCompletedIds(new Set(data.completedLessonIds || []))
    setStreak(data.streak || { current_streak: 0, total_xp: 0 })
    setLoading(false)
  }

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  if (!track) return null

  const pct = track.totalCount > 0 ? Math.round((track.completedCount / track.totalCount) * 100) : 0
  const isDone = track.completedCount === track.totalCount && track.totalCount > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <Link href="/learn" className="text-sm text-gray-400 hover:text-gray-600 transition">← Learn to cook</Link>
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

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-4xl">{track.emoji}</span>
          <div>
            <h1 className="text-2xl font-medium text-gray-900">{track.name}</h1>
            <p className="text-sm text-gray-400">{track.description}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{track.completedCount} of {track.totalCount} lessons complete</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDone ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-600"}`}>
              {isDone ? "Completed ✓" : `${pct}%`}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${isDone ? "bg-green-500" : "bg-orange-400"}`}
              style={{ width: `${pct}%` }}/>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {track.lessons?.map((lesson: any, index: number) => {
            const done = completedIds.has(lesson.id)
            const prevDone = index === 0 || completedIds.has(track.lessons[index - 1].id)
            const isNext = !done && prevDone
            const locked = !done && !isNext

            return (
              <div
                key={lesson.id}
                className={`bg-white border rounded-2xl px-4 py-3.5 flex items-center gap-4 ${locked ? "opacity-50 border-gray-100" : "border-gray-100"}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${done ? "bg-green-50 text-green-700" : isNext ? "bg-orange-50 text-orange-500" : "bg-gray-50 text-gray-400"}`}>
                  {done ? "✓" : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{lesson.title}</div>
                  <div className="text-xs text-gray-400">{lesson.description}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-orange-400 font-medium">+{lesson.xp} XP</span>
                  {done ? (
                    <Link href={`/learn/${track.slug}/${lesson.id}`} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-50 transition">
                      Review
                    </Link>
                  ) : isNext ? (
                    <Link href={`/learn/${track.slug}/${lesson.id}`} className="text-xs bg-orange-500 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-orange-600 transition">
                      Start
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-300">🔒</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {isDone && (
          <div className="mt-6 bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">🏆</div>
            <div className="text-base font-medium text-green-800 mb-1">Track complete!</div>
            <div className="text-sm text-green-600">You've mastered {track.name}. Keep going!</div>
            <Link href="/learn" className="mt-4 inline-block bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition">
              Choose next track →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}