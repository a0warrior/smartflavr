import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { getPlanStatus, runMigrations } from "@/lib/subscription"

async function isAdmin(email: string) {
  const [rows]: any = await pool.query("SELECT is_admin FROM users WHERE email = ?", [email])
  return rows.length > 0 && rows[0].is_admin === 1
}

// GET — return caller's plan status
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const status = await getPlanStatus(session.user.email)
  return NextResponse.json(status)
}

// POST — start free trial (self) or admin grant plan to any user
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { action } = body

  if (action === "start_trial") {
    const status = await getPlanStatus(session.user.email)
    if (status.trialUsed) return NextResponse.json({ error: "Trial already used" }, { status: 400 })
    if (status.plan !== "free") return NextResponse.json({ error: "Already on a paid plan" }, { status: 400 })

    const expires = new Date()
    expires.setDate(expires.getDate() + 7)
    await pool.query(
      "UPDATE users SET plan = 'pro', plan_expires_at = ?, trial_used = 1 WHERE email = ?",
      [expires, session.user.email]
    )
    return NextResponse.json({ success: true, expires })
  }

  if (action === "admin_grant") {
    if (!await isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { user_id, plan } = body
    if (!["free", "pro", "premium"].includes(plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    await runMigrations()
    await pool.query("UPDATE users SET plan = ?, plan_expires_at = NULL WHERE id = ?", [plan, user_id])

    const messages: Record<string, string> = {
      pro: "You've been granted Pro access! Enjoy 25 AI uses per week.",
      premium: "You've been granted Premium access! You now have unlimited AI uses.",
      free: "Your plan has been updated to Free.",
    }
    try {
      await pool.query(
        "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'plan_granted', ?, ?)",
        [user_id, messages[plan], JSON.stringify({ plan })]
      )
    } catch {}

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
