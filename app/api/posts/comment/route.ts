import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const post_id = searchParams.get("post_id")

  const [comments] = await pool.query(
    `SELECT post_comments.*, users.name as author_name, users.username as author_username, users.profile_image as author_image
     FROM post_comments
     LEFT JOIN users ON post_comments.user_id = users.id
     WHERE post_comments.post_id = ?
     ORDER BY post_comments.created_at ASC`,
    [post_id]
  ) as any[]

  return NextResponse.json({ comments })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { post_id, content } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
  }

  await pool.query(
    "INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)",
    [post_id, currentUser[0].id, content.trim()]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { id } = await req.json()

  await pool.query(
    "DELETE FROM post_comments WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}