import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function ensureColumn() {
  try { await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at DATETIME") } catch {}
}

// Lightweight heartbeat the client pings while the tab is visible/focused —
// lets sendPush() skip notifying someone who's already looking at the app
// (they'll see the update in-app instead) and only notify when they're
// actually away. A request with { active: false } (sent the instant the
// tab is hidden/closed) clears the timestamp immediately instead of
// waiting for it to go stale, so a delayed or dropped "hidden" signal
// can't leave push suppressed longer than necessary.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  await ensureColumn()
  if (body?.active === false) {
    await pool.query("UPDATE users SET last_active_at = NULL WHERE email = ?", [session.user.email])
  } else {
    await pool.query("UPDATE users SET last_active_at = NOW() WHERE email = ?", [session.user.email])
  }
  return NextResponse.json({ success: true })
}
