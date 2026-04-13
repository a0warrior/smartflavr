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

  const { notification_id, cookbook_id, action } = await req.json()

  if (action === "accept") {
    await pool.query(
      "UPDATE cookbook_collaborators SET status = 'accepted' WHERE cookbook_id = ? AND user_id = ?",
      [cookbook_id, currentUser[0].id]
    )
  } else {
    await pool.query(
      "UPDATE cookbook_collaborators SET status = 'declined' WHERE cookbook_id = ? AND user_id = ?",
      [cookbook_id, currentUser[0].id]
    )
  }

  await pool.query(
    "UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?",
    [notification_id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}