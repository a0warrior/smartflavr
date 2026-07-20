import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { sendPush } from "@/lib/push"

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
    "SELECT id, name, username, post_timeout_until FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  if (!currentUser || currentUser.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const timeout = currentUser[0].post_timeout_until
  if (timeout && new Date(timeout) > new Date()) {
    return NextResponse.json({ error: "timed_out", until: timeout }, { status: 403 })
  }

  const { post_id, content } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
  }

  await pool.query(
    "INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)",
    [post_id, currentUser[0].id, content.trim()]
  )

  // Notify post author (not self)
  const [postRows] = await pool.query(
    "SELECT user_id FROM posts WHERE id = ?",
    [post_id]
  ) as any[]

  if (postRows.length > 0 && postRows[0].user_id !== currentUser[0].id) {
    await pool.query(
      "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'post_comment', ?, ?)",
      [
        postRows[0].user_id,
        `${currentUser[0].name} commented on your post`,
        JSON.stringify({ commenter_username: currentUser[0].username, post_id }),
      ]
    )
    sendPush(postRows[0].user_id, { title: "New comment", body: `${currentUser[0].name} commented on your post`, url: "/feed" }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { id, content } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
  }

  await pool.query(
    "UPDATE post_comments SET content = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
    [content.trim(), id, currentUser[0].id]
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
