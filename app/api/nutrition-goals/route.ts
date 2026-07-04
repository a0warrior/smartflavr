import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

// Lazily add the column (MariaDB supports IF NOT EXISTS; swallow errors otherwise)
async function ensureColumn() {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS nutrition_goals TEXT NULL")
  } catch {}
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureColumn()
  const [rows]: any = await pool.query("SELECT nutrition_goals FROM users WHERE email = ?", [session.user.email])
  const raw = rows[0]?.nutrition_goals
  let goals = null
  try { goals = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null } catch {}
  return NextResponse.json({ goals })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goals } = await req.json()
  // goals: { calories, protein, carbs, fat } — numbers or null to clear
  await ensureColumn()
  await pool.query(
    "UPDATE users SET nutrition_goals = ? WHERE email = ?",
    [goals ? JSON.stringify(goals) : null, session.user.email]
  )
  return NextResponse.json({ success: true })
}
