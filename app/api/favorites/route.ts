import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { searchParams } = new URL(req.url)
  const recipeId = searchParams.get("recipe_id")

  // If recipe_id provided, check if that specific recipe is favorited
  if (recipeId) {
    const [rows] = await pool.query(
      "SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?",
      [currentUser[0].id, recipeId]
    ) as any[]
    return NextResponse.json({ favorited: rows.length > 0 })
  }

  // Otherwise return all favorited recipes with full recipe data
  const [favorites] = await pool.query(
    `SELECT recipes.*, cookbooks.title as cookbook_title, cookbooks.cover_emoji, cookbooks.cover_color
     FROM favorites
     JOIN recipes ON favorites.recipe_id = recipes.id
     JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
     WHERE favorites.user_id = ?
     ORDER BY favorites.created_at DESC`,
    [currentUser[0].id]
  ) as any[]

  return NextResponse.json({ favorites })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { recipe_id } = await req.json()

  await pool.query(
    "INSERT IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?)",
    [currentUser[0].id, recipe_id]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { recipe_id } = await req.json()

  await pool.query(
    "DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?",
    [currentUser[0].id, recipe_id]
  )

  return NextResponse.json({ success: true })
}