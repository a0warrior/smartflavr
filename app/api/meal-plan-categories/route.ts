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

  const [categories] = await pool.query(
    "SELECT * FROM meal_plan_categories WHERE user_id = ? ORDER BY sort_order ASC",
    [currentUser[0].id]
  ) as any[]

  return NextResponse.json({ categories })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { name } = await req.json()

  const [existing] = await pool.query(
    "SELECT MAX(sort_order) as max_order FROM meal_plan_categories WHERE user_id = ?",
    [currentUser[0].id]
  ) as any[]

  const nextOrder = (existing[0].max_order ?? -1) + 1

  await pool.query(
    "INSERT INTO meal_plan_categories (user_id, name, sort_order) VALUES (?, ?, ?)",
    [currentUser[0].id, name, nextOrder]
  )

  return NextResponse.json({ success: true })
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

  const { id, name, sort_order } = await req.json()

  if (name !== undefined) {
    await pool.query(
      "UPDATE meal_plan_categories SET name = ? WHERE id = ? AND user_id = ?",
      [name, id, currentUser[0].id]
    )
  }

  if (sort_order !== undefined) {
    await pool.query(
      "UPDATE meal_plan_categories SET sort_order = ? WHERE id = ? AND user_id = ?",
      [sort_order, id, currentUser[0].id]
    )
  }

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
    "DELETE FROM meal_plan_categories WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}