import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
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
  } else {
    await pool.query(
      "INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)",
      [post_id, currentUser[0].id]
    )
    return NextResponse.json({ liked: true })
  }
}