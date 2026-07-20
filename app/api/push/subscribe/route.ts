import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { ensurePushTable } from "@/lib/push"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (!users[0]) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { subscription } = await req.json()
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const authKey = subscription?.keys?.auth
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
  }

  await ensurePushTable()
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [users[0].id, endpoint, p256dh, authKey]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 })

  await ensurePushTable()
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint])

  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (!users[0]) return NextResponse.json({ subscribed: false })

  await ensurePushTable()
  const [subs]: any = await pool.query("SELECT id FROM push_subscriptions WHERE user_id = ?", [users[0].id])
  return NextResponse.json({ subscribed: subs.length > 0 })
}
