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

  const [notifications] = await pool.query(
    `SELECT n.*, u.username AS follower_username
     FROM notifications n
     LEFT JOIN users u ON n.type = 'new_follower' AND JSON_UNQUOTE(JSON_EXTRACT(n.data, '$.follower_id')) = u.id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC LIMIT 20`,
    [currentUser[0].id]
  ) as any[]

  const enriched = (notifications as any[]).map((n: any) => {
    if (n.type === "new_follower" && n.follower_username) {
      const data = (() => { try { return typeof n.data === "string" ? JSON.parse(n.data) : (n.data || {}) } catch { return {} } })()
      return { ...n, data: JSON.stringify({ ...data, follower_username: n.follower_username }) }
    }
    return n
  })

  const [unreadCount] = await pool.query(
    "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL",
    [currentUser[0].id]
  ) as any[]

  return NextResponse.json({ notifications: enriched, unreadCount: unreadCount[0].count })
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

  await pool.query(
    "UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL",
    [currentUser[0].id]
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
    "DELETE FROM notifications WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}