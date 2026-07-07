import { NextResponse } from "next/server"
import { auth } from "@/auth"
import pool from "@/lib/db"

const NUMBER_FIELDS = ["calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium"]
const VITAMIN_FIELDS = ["vitamin_a", "vitamin_c", "vitamin_d", "vitamin_b12", "vitamin_b6", "folate"]
const MINERAL_FIELDS = ["calcium", "iron", "potassium", "magnesium", "zinc", "phosphorus"]

function sanitizeNutrition(input: any) {
  if (!input || typeof input !== "object") return {}
  const clean: any = {}
  for (const f of NUMBER_FIELDS) {
    const v = Number(input[f])
    if (input[f] !== undefined && input[f] !== null && !isNaN(v)) clean[f] = v
  }
  for (const group of ["vitamins", "minerals"] as const) {
    const fields = group === "vitamins" ? VITAMIN_FIELDS : MINERAL_FIELDS
    const src = input[group]
    if (!src || typeof src !== "object") continue
    const out: any = {}
    for (const f of fields) {
      const v = Number(src[f])
      if (src[f] !== undefined && src[f] !== null && !isNaN(v)) out[f] = v
    }
    if (Object.keys(out).length > 0) clean[group] = out
  }
  return clean
}

// Nutrition facts are entered manually by the recipe's owner/editors — no AI.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { recipe_id, nutrition } = await req.json()
  const clean = sanitizeNutrition(nutrition)
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: "No nutrition values provided" }, { status: 400 })
  }

  // Only the cookbook owner or an editor collaborator may write nutrition to a recipe
  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  const userId = users[0]?.id
  const [rows]: any = await pool.query(
    "SELECT c.id as cookbook_id, c.user_id FROM recipes r JOIN cookbooks c ON r.cookbook_id = c.id WHERE r.id = ?",
    [recipe_id]
  )
  if (!rows[0]) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
  if (rows[0].user_id !== userId) {
    let allowed = false
    try {
      const [collabs]: any = await pool.query(
        "SELECT role FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
        [rows[0].cookbook_id, userId]
      )
      allowed = !!collabs[0] && collabs[0].role !== "viewer"
    } catch {
      const [collabs]: any = await pool.query(
        "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
        [rows[0].cookbook_id, userId]
      )
      allowed = !!collabs[0]
    }
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await pool.query("UPDATE recipes SET nutrition = ? WHERE id = ?", [JSON.stringify(clean), recipe_id])
  return NextResponse.json({ success: true, nutrition: clean })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { recipe_id } = await req.json()

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  const userId = users[0]?.id
  const [rows]: any = await pool.query(
    "SELECT c.id as cookbook_id, c.user_id FROM recipes r JOIN cookbooks c ON r.cookbook_id = c.id WHERE r.id = ?",
    [recipe_id]
  )
  if (!rows[0]) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
  if (rows[0].user_id !== userId) {
    let allowed = false
    try {
      const [collabs]: any = await pool.query(
        "SELECT role FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
        [rows[0].cookbook_id, userId]
      )
      allowed = !!collabs[0] && collabs[0].role !== "viewer"
    } catch {
      const [collabs]: any = await pool.query(
        "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
        [rows[0].cookbook_id, userId]
      )
      allowed = !!collabs[0]
    }
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await pool.query("UPDATE recipes SET nutrition = NULL WHERE id = ?", [recipe_id])
  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const recipe_id = searchParams.get("recipe_id")
  const [recipes] = await pool.query("SELECT nutrition FROM recipes WHERE id = ?", [recipe_id]) as any[]
  if (!recipes || recipes.length === 0) return NextResponse.json({ nutrition: null })
  const nutrition = recipes[0].nutrition
  return NextResponse.json({ nutrition: typeof nutrition === "string" ? JSON.parse(nutrition) : nutrition })
}
