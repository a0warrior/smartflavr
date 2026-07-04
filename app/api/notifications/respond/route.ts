import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const { notification_id, action } = await req.json()

  const [notifs] = await pool.query(
    "SELECT type, data FROM notifications WHERE id = ? AND user_id = ?",
    [notification_id, me.id]
  ) as any[]
  if (!(notifs as any[])[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const notif = (notifs as any[])[0]
  const data = typeof notif.data === "string" ? JSON.parse(notif.data) : (notif.data || {})

  // Always mark read
  await pool.query(
    "UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?",
    [notification_id, me.id]
  )

  if (notif.type === "collab_invite") {
    const cookbook_id = data.cookbook_id
    const [pending] = await pool.query(
      "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'pending'",
      [cookbook_id, me.id]
    ) as any[]
    if (!(pending as any[])[0]) return NextResponse.json({ revoked: true, message: "This invitation is no longer available." })
    await pool.query(
      "UPDATE cookbook_collaborators SET status = ? WHERE cookbook_id = ? AND user_id = ?",
      [action === "accept" ? "accepted" : "declined", cookbook_id, me.id]
    )

  } else if (notif.type === "grocery_invite") {
    const list_id = data.list_id
    const [pending] = await pool.query(
      "SELECT id FROM grocery_list_collaborators WHERE grocery_list_id = ? AND user_id = ? AND status = 'pending'",
      [list_id, me.id]
    ) as any[]
    if (!(pending as any[])[0]) return NextResponse.json({ revoked: true, message: "This invitation is no longer available." })
    await pool.query(
      "UPDATE grocery_list_collaborators SET status = ? WHERE grocery_list_id = ? AND user_id = ?",
      [action === "accept" ? "accepted" : "declined", list_id, me.id]
    )

  } else if (notif.type === "meal_plan_invite") {
    const owner_user_id = data.owner_user_id
    const [pending] = await pool.query(
      "SELECT id FROM meal_plan_collaborators WHERE owner_user_id = ? AND collaborator_user_id = ? AND status = 'pending'",
      [owner_user_id, me.id]
    ) as any[]
    if (!(pending as any[])[0]) return NextResponse.json({ revoked: true, message: "This invitation is no longer available." })
    await pool.query(
      "UPDATE meal_plan_collaborators SET status = ? WHERE owner_user_id = ? AND collaborator_user_id = ?",
      [action === "accept" ? "accepted" : "declined", owner_user_id, me.id]
    )
  }

  return NextResponse.json({ success: true })
}
