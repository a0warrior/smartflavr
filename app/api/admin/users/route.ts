import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function isAdmin(email: string) {
  const [users]: any = await pool.query(
    "SELECT is_admin FROM users WHERE email = ?",
    [email]
  )
  return users.length > 0 && users[0].is_admin === 1
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!await isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { user_id, is_admin } = await req.json()

  await pool.query(
    "UPDATE users SET is_admin = ? WHERE id = ?",
    [is_admin, user_id]
  )

  return NextResponse.json({ success: true })
}