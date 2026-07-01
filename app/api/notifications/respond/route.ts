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

  // Check that the invite still exists in pending state before acting on it
  const [pending]: any = await pool.query(
    "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'pending'",
    [cookbook_id, currentUser[0].id]
  )

  // Always mark the notification read (invite may have been withdrawn)
  await pool.query(
    "UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?",
    [notification_id, currentUser[0].id]
  )

  if (!pending || pending.length === 0) {
    return NextResponse.json({ revoked: true, message: "This invitation is no longer available." })
  }

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

  return NextResponse.json({ success: true })
}