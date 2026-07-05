import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function ensureTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS inventory_categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      name VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_cat (user_id, name)
    )`)
  } catch {}
}

async function getUserId(email: string) {
  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [email])
  return users[0]?.id
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const userId = await getUserId(session.user.email)
  const [rows]: any = await pool.query("SELECT id, name FROM inventory_categories WHERE user_id = ? ORDER BY name", [userId])
  return NextResponse.json({ categories: rows })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const userId = await getUserId(session.user.email)
  const { name } = await req.json()
  const trimmed = (name || "").trim().slice(0, 50)
  if (!trimmed) return NextResponse.json({ error: "Name required" }, { status: 400 })
  try {
    await pool.query("INSERT INTO inventory_categories (user_id, name) VALUES (?, ?)", [userId, trimmed])
  } catch {
    return NextResponse.json({ error: "Category already exists" }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const userId = await getUserId(session.user.email)
  const { id } = await req.json()
  await pool.query("DELETE FROM inventory_categories WHERE id = ? AND user_id = ?", [id, userId])
  return NextResponse.json({ success: true })
}
