import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id, name, username FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { post_id } = await req.json()

  const [existing] = await pool.query(
    "SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?",
    [post_id, currentUser[0].id]
  ) as any[]

  if (existing.length > 0) {
    await pool.query(
      "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?",
      [post_id, currentUser[0].id]
    )
    return NextResponse.json({ liked: false })
  }

  await pool.query(
    "INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)",
    [post_id, currentUser[0].id]
  )

  // Notify post author (not self)
  const [postRows] = await pool.query(
    "SELECT user_id FROM posts WHERE id = ?",
    [post_id]
  ) as any[]

  if (postRows.length > 0 && postRows[0].user_id !== currentUser[0].id) {
    await pool.query(
      "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'post_like', ?, ?)",
      [
        postRows[0].user_id,
        `${currentUser[0].name} liked your post`,
        JSON.stringify({ liker_username: currentUser[0].username, post_id }),
      ]
    )
  }

  return NextResponse.json({ liked: true })
}
