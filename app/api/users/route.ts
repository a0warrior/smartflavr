import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") || ""

  const [currentUser]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  const [users]: any = await pool.query(
    `SELECT 
      users.id,
      users.name,
      users.username,
      users.bio,
      users.profile_image,
      COUNT(DISTINCT follows.id) as follower_count
    FROM users
    LEFT JOIN follows ON follows.following_id = users.id
    WHERE users.id != ?
    AND users.username IS NOT NULL
    AND (users.name LIKE ? OR users.username LIKE ?)
    GROUP BY users.id
    ORDER BY follower_count DESC
    LIMIT 20`,
    [currentUser[0].id, `%${query}%`, `%${query}%`]
  )

  return NextResponse.json({ users })
}