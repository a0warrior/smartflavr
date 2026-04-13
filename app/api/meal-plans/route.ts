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

  const { searchParams } = new URL(req.url)
  const start = searchParams.get("start")
  const end = searchParams.get("end")

  const [meals] = await pool.query(
    `SELECT meal_plans.*, recipes.title as recipe_title, recipes.image_url as recipe_image,
     recipes.prep_time, recipes.servings, recipes.nutrition, recipes.ingredients,
     recipes.description as recipe_description,
     cookbooks.id as cookbook_id
     FROM meal_plans
     LEFT JOIN recipes ON meal_plans.recipe_id = recipes.id
     LEFT JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
     WHERE meal_plans.user_id = ?
     AND meal_plans.meal_date BETWEEN ? AND ?
     ORDER BY meal_plans.meal_date ASC, meal_plans.meal_type ASC`,
    [currentUser[0].id, start, end]
  ) as any[]

  const [categories] = await pool.query(
    "SELECT * FROM meal_plan_categories WHERE user_id = ? ORDER BY sort_order ASC",
    [currentUser[0].id]
  ) as any[]

  return NextResponse.json({ meals, categories })
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

  const { recipe_id, meal_date, meal_type } = await req.json()

  await pool.query(
    "INSERT INTO meal_plans (user_id, recipe_id, meal_date, meal_type) VALUES (?, ?, ?, ?)",
    [currentUser[0].id, recipe_id, meal_date, meal_type]
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
    "DELETE FROM meal_plans WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}