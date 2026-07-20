import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function ensureCustomTitleColumn() {
  try { await pool.query("ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS custom_title VARCHAR(200)") } catch {}
  try { await pool.query("ALTER TABLE meal_plans MODIFY recipe_id INT NULL") } catch {}
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const { searchParams } = new URL(req.url)
  const start = searchParams.get("start")
  const end = searchParams.get("end")

  await ensureCustomTitleColumn()
  const [meals] = await pool.query(
    `SELECT meal_plans.*, COALESCE(recipes.title, meal_plans.custom_title) as recipe_title, recipes.image_url as recipe_image,
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
      `SELECT meal_plans.*, COALESCE(recipes.title, meal_plans.custom_title) as recipe_title, recipes.image_url as recipe_image,
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
  const userId = currentUser[0]?.id

  const { recipe_id, custom_title, meal_date, meal_type } = await req.json()

  if (!meal_date || !meal_type) {
    return NextResponse.json({ error: "meal_date and meal_type are required" }, { status: 400 })
  }

  await ensureCustomTitleColumn()

  if (recipe_id) {
    // The recipe must be visible to this user: their own, public, or a
    // cookbook they're an accepted collaborator on. Meal plans can point at
    // any recipe you can legitimately see, not just ones in your own cookbooks.
    const [rows]: any = await pool.query(
      `SELECT c.id FROM recipes r JOIN cookbooks c ON r.cookbook_id = c.id
       LEFT JOIN cookbook_collaborators cc ON cc.cookbook_id = c.id AND cc.user_id = ? AND cc.status = 'accepted'
       WHERE r.id = ? AND (c.is_public = 1 OR c.user_id = ? OR cc.id IS NOT NULL)`,
      [userId, recipe_id, userId]
    )
    if (!rows[0]) return NextResponse.json({ error: "Recipe not found or not accessible" }, { status: 403 })

    await pool.query(
      "INSERT INTO meal_plans (user_id, recipe_id, meal_date, meal_type) VALUES (?, ?, ?, ?)",
      [userId, recipe_id, meal_date, meal_type]
    )
  } else if (typeof custom_title === "string" && custom_title.trim()) {
    await pool.query(
      "INSERT INTO meal_plans (user_id, custom_title, meal_date, meal_type) VALUES (?, ?, ?, ?)",
      [userId, custom_title.trim().slice(0, 200), meal_date, meal_type]
    )
  } else {
    return NextResponse.json({ error: "recipe_id or custom_title is required" }, { status: 400 })
  }

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
