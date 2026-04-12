import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, description, ingredients, instructions, source_url, prep_time, servings, cookbook_id } = await req.json()

  const [users]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  await pool.query(
    "INSERT INTO recipes (cookbook_id, user_id, title, description, ingredients, instructions, source_url, prep_time, servings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [cookbook_id, users[0].id, title, description, ingredients, instructions, source_url, prep_time, servings]
  )

  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cookbook_id = searchParams.get("cookbook_id")

  const [recipes]: any = await pool.query(
    "SELECT * FROM recipes WHERE cookbook_id = ? ORDER BY created_at DESC",
    [cookbook_id]
  )

  return NextResponse.json({ recipes })
}