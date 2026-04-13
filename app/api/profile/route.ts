import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [users]: any = await pool.query(
    "SELECT id, name, email, image, username, bio, profile_image FROM users WHERE email = ?",
    [session.user.email]
  )

  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({ user: users[0] })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { username, bio, profile_image } = await req.json()

  const [existing]: any = await pool.query(
    "SELECT id FROM users WHERE username = ? AND email != ?",
    [username, session.user.email]
  )

  if (existing.length > 0) {
    return NextResponse.json({ error: "Username already taken" }, { status: 400 })
  }

  await pool.query(
    "UPDATE users SET username = ?, bio = ?, profile_image = ? WHERE email = ?",
    [username, bio, profile_image || null, session.user.email]
  )

  return NextResponse.json({ success: true })
}