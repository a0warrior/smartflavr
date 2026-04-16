import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const userId = users[0].id
  const { lesson_id, xp } = await req.json()

  await pool.query("INSERT IGNORE INTO learn_progress (user_id, lesson_id) VALUES (?, ?)", [userId, lesson_id])

  const today = new Date().toISOString().split("T")[0]
  const [existing]: any = await pool.query("SELECT * FROM learn_streaks WHERE user_id = ?", [userId])

  if (existing.length === 0) {
    await pool.query("INSERT INTO learn_streaks (user_id, current_streak, last_activity, total_xp) VALUES (?, 1, ?, ?)", [userId, today, xp])
  } else {
    const last = existing[0].last_activity ? new Date(existing[0].last_activity).toISOString().split("T")[0] : null
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
    let newStreak = existing[0].current_streak
    if (last === today) { /* already active today */ }
    else if (last === yesterday) { newStreak += 1 }
    else { newStreak = 1 }
    await pool.query("UPDATE learn_streaks SET current_streak = ?, last_activity = ?, total_xp = total_xp + ? WHERE user_id = ?", [newStreak, today, xp, userId])
  }

  return NextResponse.json({ success: true })
}