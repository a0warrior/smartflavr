import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

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
    [me.id, start, end]
  ) as any[]

  const [categories] = await pool.query(
    "SELECT * FROM meal_plan_categories WHERE user_id = ? ORDER BY sort_order ASC",
    [me.id]
  ) as any[]

  // Fetch accepted sync partners' meals
  const [syncRows] = await pool.query(
    `SELECT CASE WHEN owner_user_id = ? THEN collaborator_user_id ELSE owner_user_id END as partner_id
     FROM meal_plan_collaborators
     WHERE (owner_user_id = ? OR collaborator_user_id = ?) AND status = 'accepted'`,
    [me.id, me.id, me.id]
  ) as any[]

  let collaboratorMeals: any[] = []
  if ((syncRows as any[]).length > 0) {
    const partnerIds = (syncRows as any[]).map((r: any) => r.partner_id)
    const [colMeals] = await pool.query(
      `SELECT meal_plans.*, recipes.title as recipe_title, recipes.image_url as recipe_image,
       recipes.prep_time, recipes.servings, recipes.nutrition, recipes.ingredients,
       recipes.description as recipe_description,
       cookbooks.id as cookbook_id,
       users.name as partner_name, users.profile_image as partner_image
       FROM meal_plans
       LEFT JOIN recipes ON meal_plans.recipe_id = recipes.id
       LEFT JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
       LEFT JOIN users ON meal_plans.user_id = users.id
       WHERE meal_plans.user_id IN (?)
       AND meal_plans.meal_date BETWEEN ? AND ?
       ORDER BY meal_plans.meal_date ASC, meal_plans.meal_type ASC`,
      [partnerIds, start, end]
    ) as any[]
    collaboratorMeals = colMeals as any[]
  }

  return NextResponse.json({ meals, categories, collaboratorMeals })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { recipe_id, meal_date, meal_type } = await req.json()

  await pool.query(
    "INSERT INTO meal_plans (user_id, recipe_id, meal_date, meal_type) VALUES (?, ?, ?, ?)",
    [currentUser[0].id, recipe_id, meal_date, meal_type]
  )

  return NextResponse.json({ success: true })
}

// Move a meal to a different day/category
export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { id, meal_date, meal_type } = await req.json()

  await pool.query(
    "UPDATE meal_plans SET meal_date = ?, meal_type = ?, synced_to_calendar = 0, gcal_event_id = NULL WHERE id = ? AND user_id = ?",
    [meal_date, meal_type, id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { id } = await req.json()

  await pool.query(
    "DELETE FROM meal_plans WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}
