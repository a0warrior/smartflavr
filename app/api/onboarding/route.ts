import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function ensureColumn() {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at DATETIME NULL")
  } catch {}
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureColumn()
  const [rows]: any = await pool.query(
    "SELECT id, username, onboarded_at FROM users WHERE email = ?",
    [session.user.email]
  )
  const user = rows[0]
  if (!user) return NextResponse.json({ onboarded: false, hasUsername: false, exists: false })

  return NextResponse.json({
    onboarded: !!user.onboarded_at,
    hasUsername: !!user.username,
    exists: true,
  })
}

export async function PUT() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureColumn()
  await pool.query("UPDATE users SET onboarded_at = NOW() WHERE email = ?", [session.user.email])
  return NextResponse.json({ success: true })
}
