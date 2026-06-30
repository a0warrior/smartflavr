import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function isAdmin(email: string) {
  const [rows]: any = await pool.query("SELECT is_admin FROM users WHERE email = ?", [email])
  return rows.length > 0 && rows[0].is_admin === 1
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email || !await isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(10) NOT NULL DEFAULT 'free'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at DATETIME NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_uses_week INT NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_week_reset_at DATETIME NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) NULL`,
  ]

  const results: string[] = []
  for (const sql of migrations) {
    try {
      await pool.query(sql)
      results.push(`OK: ${sql.substring(0, 60)}`)
    } catch (e: any) {
      results.push(`ERR: ${e.message}`)
    }
  }

  return NextResponse.json({ results })
}
