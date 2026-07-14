import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { safeHttpUrl } from "@/lib/sanitize"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, description, ingredients, instructions, source_url, prep_time, servings, cookbook_id, notes, difficulty, category_id, sort_order, image_url, nutrition, copy_nutrition, allow_duplicate } = await req.json()

  // Nutrition only rides along on explicit recipe copies — never on imports/extracts
  const allowedNutrition = copy_nutrition === true ? nutrition : null

  const [users]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  if (users.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Duplicate guard: same title already in the target cookbook. Blank titles
  // are exempt (the editor creates recipes with title "" before the user types).
  // Callers retry with allow_duplicate:true after the user confirms.
  if (typeof title === "string" && title.trim() && allow_duplicate !== true) {
    const [dupes]: any = await pool.query(
      "SELECT id FROM recipes WHERE cookbook_id = ? AND LOWER(TRIM(title)) = LOWER(?) LIMIT 1",
      [cookbook_id, title.trim()]
    )
    if (dupes.length > 0) {
      return NextResponse.json({ duplicate: true, error: "duplicate" }, { status: 409 })
    }
  }

  const [result]: any = await pool.query(
    "INSERT INTO recipes (cookbook_id, user_id, title, description, ingredients, instructions, source_url, prep_time, servings, notes, difficulty, category_id, sort_order, image_url, nutrition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [cookbook_id, users[0].id, title, description, ingredients, instructions, safeHttpUrl(source_url) || null, prep_time, servings, notes || null, difficulty || null, category_id || null, sort_order || 0, image_url || null, allowedNutrition ? JSON.stringify(allowedNutrition) : null]
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

  // Check access: must be public, owner, or accepted collaborator
  const [currentUser]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  const userId = currentUser[0]?.id

  const [cbRows]: any = await pool.query(
    "SELECT is_public, user_id FROM cookbooks WHERE id = ?",
    [cookbook_id]
  )
  if (cbRows.length === 0) return NextResponse.json({ recipes: [] })

  const cb = cbRows[0]
  if (!cb.is_public && cb.user_id !== userId) {
    const [collabs]: any = await pool.query(
      "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
      [cookbook_id, userId]
    )
    if (collabs.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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