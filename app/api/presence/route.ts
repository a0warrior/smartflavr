import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function ensureColumn() {
  try { await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at DATETIME") } catch {}
}

// Lightweight heartbeat the client pings while the tab is visible/focused —
// lets sendPush() skip notifying someone who's already looking at the app
// (they'll see the update in-app instead) and only notify when they're
// actually away.
export async function POST() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureColumn()
  await pool.query("UPDATE users SET last_active_at = NOW() WHERE email = ?", [session.user.email])
  return NextResponse.json({ success: true })
}
