import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [users]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  if (users.length === 0) {
    return NextResponse.json({ cookbooks: [] })
  }

  const [cookbooks]: any = await pool.query(
    "SELECT * FROM cookbooks WHERE user_id = ? ORDER BY created_at DESC",
    [users[0].id]
  )

  return NextResponse.json({ cookbooks })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, description, cover_emoji, cover_color } = await req.json()

  let [users]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  if (users.length === 0) {
    await pool.query(
      "INSERT INTO users (name, email, image) VALUES (?, ?, ?)",
      [session.user.name, session.user.email, session.user.image]
    )
    ;[users] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [session.user.email]
    )
  }

  await pool.query(
    "INSERT INTO cookbooks (user_id, title, description, cover_emoji, cover_color, cover_image) VALUES (?, ?, ?, ?, ?, ?)",
    [users[0].id, title, description, cover_emoji || "📖", cover_color || "#F97316", null]
  )

  return NextResponse.json({ success: true })
}