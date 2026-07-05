import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

// Returns the full recipe behind a meal. Access is granted through meal
// ownership — your own meals, or meals of an accepted sync partner — NOT
// through cookbook permissions. Putting a meal on a shared plan shares that
// recipe's content, never the cookbook it lives in.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const { searchParams } = new URL(req.url)
  const meal_id = searchParams.get("meal_id")

  const [meals] = await pool.query("SELECT user_id, recipe_id FROM meal_plans WHERE id = ?", [meal_id]) as any[]
  const meal = (meals as any[])[0]
  if (!meal) return NextResponse.json({ error: "Meal not found" }, { status: 404 })

  if (meal.user_id !== me.id) {
    const [syncs] = await pool.query(
      `SELECT id FROM meal_plan_collaborators
       WHERE status = 'accepted'
       AND ((owner_user_id = ? AND collaborator_user_id = ?) OR (owner_user_id = ? AND collaborator_user_id = ?))`,
      [me.id, meal.user_id, meal.user_id, me.id]
    ) as any[]
    if (!(syncs as any[])[0]) return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  const [recipes] = await pool.query(
    `SELECT r.id, r.title, r.description, r.ingredients, r.instructions, r.notes,
     r.prep_time, r.servings, r.difficulty, r.image_url, r.nutrition,
     u.name as owner_name
     FROM recipes r
     LEFT JOIN cookbooks c ON r.cookbook_id = c.id
     LEFT JOIN users u ON c.user_id = u.id
     WHERE r.id = ?`,
    [meal.recipe_id]
  ) as any[]
  const recipe = (recipes as any[])[0]
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })

  return NextResponse.json({ recipe })
}
