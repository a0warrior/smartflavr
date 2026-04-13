import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [users] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  if (!users || users.length === 0) {
    return NextResponse.json({ cookbooks: [], collaborated: [] })
  }

  const [cookbooks] = await pool.query(
    "SELECT * FROM cookbooks WHERE user_id = ? ORDER BY created_at DESC",
    [users[0].id]
  ) as any[]

  const [collaborated] = await pool.query(
    `SELECT cookbooks.*, users.name as owner_name, users.username as owner_username, users.profile_image as owner_image
    FROM cookbook_collaborators
    LEFT JOIN cookbooks ON cookbook_collaborators.cookbook_id = cookbooks.id
    LEFT JOIN users ON cookbooks.user_id = users.id
    WHERE cookbook_collaborators.user_id = ?
    AND cookbook_collaborators.status = 'accepted'
    ORDER BY cookbooks.created_at DESC`,
  [users[0].id]
) as any[]

  return NextResponse.json({ cookbooks, collaborated })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, description, cover_emoji, cover_color } = await req.json()

  let [users] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  if (!users || users.length === 0) {
    await pool.query(
      "INSERT INTO users (name, email, image) VALUES (?, ?, ?)",
      [session.user?.name, session.user?.email, session.user?.image]
    )
    ;[users] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [session.user.email]
    ) as any[]
  }

  await pool.query(
    "INSERT INTO cookbooks (user_id, title, description, cover_emoji, cover_color, cover_image) VALUES (?, ?, ?, ?, ?, ?)",
    [users[0].id, title, description, cover_emoji || "📖", cover_color || "#F97316", null]
  )

  return NextResponse.json({ success: true })
}