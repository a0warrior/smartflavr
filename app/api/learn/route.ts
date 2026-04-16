import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const userId = users[0].id

  const [tracks]: any = await pool.query("SELECT * FROM learn_tracks ORDER BY sort_order")
  const [lessons]: any = await pool.query("SELECT * FROM learn_lessons ORDER BY track_id, sort_order")
  const [progress]: any = await pool.query("SELECT lesson_id FROM learn_progress WHERE user_id = ?", [userId])
  const [streak]: any = await pool.query("SELECT * FROM learn_streaks WHERE user_id = ?", [userId])

  const completedIds = new Set(progress.map((p: any) => p.lesson_id))

  const tracksWithLessons = tracks.map((track: any) => {
    const trackLessons = lessons.filter((l: any) => l.track_id === track.id)
    const completedCount = trackLessons.filter((l: any) => completedIds.has(l.id)).length
    return { ...track, lessons: trackLessons, completedCount, totalCount: trackLessons.length }
  })

  return NextResponse.json({
    tracks: tracksWithLessons,
    completedLessonIds: [...completedIds],
    streak: streak[0] || { current_streak: 0, total_xp: 0 },
  })
}