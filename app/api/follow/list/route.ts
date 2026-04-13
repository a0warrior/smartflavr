import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")
  const type = searchParams.get("type")

  const [targetUser] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  ) as any[]

  if (!targetUser || targetUser.length === 0) {
    return NextResponse.json({ users: [] })
  }

  let users: any[]

  if (type === "followers") {
    ;[users] = await pool.query(
      `SELECT users.id, users.name, users.username, users.profile_image, users.bio
       FROM follows
       LEFT JOIN users ON follows.follower_id = users.id
       WHERE follows.following_id = ?
       ORDER BY follows.created_at DESC`,
      [targetUser[0].id]
    ) as any[]
  } else {
    ;[users] = await pool.query(
      `SELECT users.id, users.name, users.username, users.profile_image, users.bio
       FROM follows
       LEFT JOIN users ON follows.following_id = users.id
       WHERE follows.follower_id = ?
       ORDER BY follows.created_at DESC`,
      [targetUser[0].id]
    ) as any[]
  }

  return NextResponse.json({ users })
}