import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { sendPush } from "@/lib/push"
import { getPrivacy } from "@/lib/privacy"

// Lightweight counts-only fetch so other viewers can live-sync a post's
// like/comment counts without refetching (or re-authoring-checking) the
// whole feed.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const postId = searchParams.get("post_id")
  if (!postId) return NextResponse.json({ error: "post_id required" }, { status: 400 })

  const [rows] = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM post_likes WHERE post_id = ?) as like_count,
      (SELECT COUNT(*) FROM post_comments WHERE post_id = ?) as comment_count`,
    [postId, postId]
  ) as any[]

  return NextResponse.json({ like_count: rows[0]?.like_count ?? 0, comment_count: rows[0]?.comment_count ?? 0 })
}

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
    const authorPrivacy = await getPrivacy(postRows[0].user_id)
    if (authorPrivacy.notify_post_like) {
      await pool.query(
        "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'post_like', ?, ?)",
        [
          postRows[0].user_id,
          `${currentUser[0].name} liked your post`,
          JSON.stringify({ liker_username: currentUser[0].username, post_id }),
        ]
      )
      sendPush(postRows[0].user_id, { title: "New like", body: `${currentUser[0].name} liked your post`, url: "/feed" }).catch(() => {})
    }
  }

  return NextResponse.json({ liked: true })
}
