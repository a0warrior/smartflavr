import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function ensureDietaryColumn() {
  try { await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT") } catch {}
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureDietaryColumn()
  const [users]: any = await pool.query(
    "SELECT id, name, email, image, username, bio, profile_image, is_admin, post_timeout_until, dietary_restrictions FROM users WHERE email = ?",
    [session.user.email]
  )

  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const user = users[0]
  let dietary_restrictions: string[] = []
  try { dietary_restrictions = user.dietary_restrictions ? JSON.parse(user.dietary_restrictions) : [] } catch {}

  return NextResponse.json({ user: { ...user, dietary_restrictions } })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { username, bio, profile_image, name, dietary_restrictions } = await req.json()

  const [existing]: any = await pool.query(
    "SELECT id FROM users WHERE username = ? AND email != ?",
    [username, session.user.email]
  )

  if (existing.length > 0) {
    return NextResponse.json({ error: "Username already taken" }, { status: 400 })
  }

  await ensureDietaryColumn()
  const cleanDietary = Array.isArray(dietary_restrictions)
    ? dietary_restrictions.filter((d: unknown) => typeof d === "string" && d.trim()).map((d: string) => d.trim().slice(0, 60)).slice(0, 20)
    : undefined

  if (cleanDietary !== undefined) {
    await pool.query(
      "UPDATE users SET username = ?, bio = ?, profile_image = ?, name = ?, dietary_restrictions = ? WHERE email = ?",
      [username, bio, profile_image || null, name, JSON.stringify(cleanDietary), session.user.email]
    )
  } else {
    await pool.query(
      "UPDATE users SET username = ?, bio = ?, profile_image = ?, name = ? WHERE email = ?",
      [username, bio, profile_image || null, name, session.user.email]
    )
  }

  return NextResponse.json({ success: true })
}