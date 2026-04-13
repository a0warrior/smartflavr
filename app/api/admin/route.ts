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

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!await isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [codes]: any = await pool.query(
    `SELECT invite_codes.*, users.name as used_by_name, users.email as used_by_email
     FROM invite_codes
     LEFT JOIN users ON invite_codes.used_by = users.id
     ORDER BY invite_codes.created_at DESC`
  )

  const [users]: any = await pool.query(
    `SELECT users.*, 
      COUNT(DISTINCT cookbooks.id) as cookbook_count,
      COUNT(DISTINCT recipes.id) as recipe_count
     FROM users
     LEFT JOIN cookbooks ON cookbooks.user_id = users.id
     LEFT JOIN recipes ON recipes.user_id = users.id
     GROUP BY users.id
     ORDER BY users.created_at DESC`
  )

  return NextResponse.json({ codes, users })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!await isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { code } = await req.json()

  const [existing]: any = await pool.query(
    "SELECT id FROM invite_codes WHERE code = ?",
    [code.toUpperCase()]
  )

  if (existing.length > 0) {
    return NextResponse.json({ error: "Code already exists" }, { status: 400 })
  }

  await pool.query(
    "INSERT INTO invite_codes (code) VALUES (?)",
    [code.toUpperCase()]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!await isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { code } = await req.json()

  await pool.query(
    "DELETE FROM invite_codes WHERE code = ?",
    [code.toUpperCase()]
  )

  return NextResponse.json({ success: true })
}