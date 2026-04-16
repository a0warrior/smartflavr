import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, description, ingredients, instructions, source_url, prep_time, servings, cookbook_id, notes, difficulty, category_id, sort_order, image_url, nutrition } = await req.json()

  const [users]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const [result]: any = await pool.query(
    "INSERT INTO recipes (cookbook_id, user_id, title, description, ingredients, instructions, source_url, prep_time, servings, notes, difficulty, category_id, sort_order, image_url, nutrition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [cookbook_id, users[0].id, title, description, ingredients, instructions, source_url, prep_time, servings, notes || null, difficulty || null, category_id || null, sort_order || 0, image_url || null, nutrition ? JSON.stringify(nutrition) : null]
  )

  return NextResponse.json({ success: true, id: result.insertId })
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cookbook_id = searchParams.get("cookbook_id")

  const [recipes]: any = await pool.query(
    `SELECT recipes.*, categories.name as category_name
     FROM recipes
     LEFT JOIN categories ON recipes.category_id = categories.id
     WHERE recipes.cookbook_id = ?
     ORDER BY recipes.sort_order ASC`,
    [cookbook_id]
  )

  return NextResponse.json({ recipes })
}