import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { createCookTimer, cancelCookTimer, getActiveCookTimers, rescheduleAllPending } from "@/lib/cookTimers"

// Re-arm any timers that were still pending when this server process last
// started (e.g. after a deploy). Fire-and-forget at module load so it runs
// once per process regardless of which request first touches this route.
rescheduleAllPending()

async function getUserId(email: string) {
  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [email])
  return users[0]?.id || null
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ timers: [] })

  const timers = await getActiveCookTimers(userId)
  return NextResponse.json({ timers })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { label, recipe_title, duration_ms, cookbook_id, recipe_id, step_index } = await req.json()
  if (!label || typeof duration_ms !== "number" || duration_ms <= 0) {
    return NextResponse.json({ error: "label and duration_ms are required" }, { status: 400 })
  }
  // Cap at 12 hours — guards against a malformed/huge value scheduling
  // something absurd server-side.
  const cappedMs = Math.min(duration_ms, 12 * 60 * 60 * 1000)

  // The UI already stops offering to start more past 8, but that's only
  // enforced client-side — guard the API itself too, well above that (a
  // generous ceiling, not a UX-facing limit) so a direct/scripted call
  // can't queue up an unbounded number of rows and in-memory setTimeouts.
  const existing = await getActiveCookTimers(userId)
  if (existing.length >= 20) {
    return NextResponse.json({ error: "Too many active timers" }, { status: 429 })
  }

  const timer = await createCookTimer(
    userId,
    String(label).slice(0, 200),
    recipe_title ? String(recipe_title).slice(0, 255) : null,
    cappedMs,
    typeof cookbook_id === "number" ? cookbook_id : null,
    typeof recipe_id === "number" ? recipe_id : null,
    typeof step_index === "number" ? step_index : null
  )
  return NextResponse.json({ success: true, ...timer })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await cancelCookTimer(userId, id)
  return NextResponse.json({ success: true })
}
