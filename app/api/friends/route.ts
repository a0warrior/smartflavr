import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  if (!currentUser || currentUser.length === 0) {
    return NextResponse.json({ friends: [] })
  }

  const [friends] = await pool.query(
    `SELECT users.id, users.name, users.username, users.profile_image
     FROM follows f1
     JOIN follows f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id
     JOIN users ON users.id = f1.following_id
     WHERE f1.follower_id = ?
     ORDER BY users.name ASC`,
    [currentUser[0].id]
  ) as any[]

  return NextResponse.json({ friends })
}