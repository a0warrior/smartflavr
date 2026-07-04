import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import crypto from "crypto"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { list_id } = await req.json()
  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const [lists] = await pool.query(
    "SELECT id, share_token FROM grocery_lists WHERE id = ? AND user_id = ?",
    [list_id, currentUser[0].id]
  ) as any[]

  if (!lists[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let token = lists[0].share_token
  if (!token) {
    token = crypto.randomBytes(16).toString("hex")
    await pool.query("UPDATE grocery_lists SET share_token = ? WHERE id = ?", [token, list_id])
  }

  return NextResponse.json({ success: true, token })
}
