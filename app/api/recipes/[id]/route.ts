import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

// Only the cookbook owner or an accepted editor collaborator may change a recipe
async function canEditRecipe(recipeId: string, email: string): Promise<boolean> {
  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [email])
  const userId = users[0]?.id
  if (!userId) return false
  const [rows]: any = await pool.query(
    "SELECT c.id as cookbook_id, c.user_id FROM recipes r JOIN cookbooks c ON r.cookbook_id = c.id WHERE r.id = ?",
    [recipeId]
  )
  if (!rows[0]) return false
  if (rows[0].user_id === userId) return true
  try {
    const [collabs]: any = await pool.query(
      "SELECT role FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
      [rows[0].cookbook_id, userId]
    )
    return !!collabs[0] && collabs[0].role !== "viewer"
  } catch {
    // role column not migrated yet — fall back to any accepted collaborator
    const [collabs]: any = await pool.query(
      "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
      [rows[0].cookbook_id, userId]
    )
    return !!collabs[0]
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!await canEditRecipe(id, session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { title, description, ingredients, instructions, notes, prep_time, servings, difficulty, sort_order, category_id, image_url, _saveVersion } = await req.json()

  await pool.query(
    "UPDATE recipes SET title=?, description=?, ingredients=?, instructions=?, notes=?, prep_time=?, servings=?, difficulty=?, sort_order=?, category_id=?, image_url=? WHERE id=?",
    [title, description, ingredients, instructions, notes, prep_time, servings, difficulty, sort_order || 0, category_id || null, image_url || null, id]
  )

  if (_saveVersion) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS recipe_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipe_id INT NOT NULL,
        data JSON NOT NULL,
        saved_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recipe_versions_recipe (recipe_id)
      )`)
      await pool.query(
        "INSERT INTO recipe_versions (recipe_id, data, saved_by) VALUES (?, ?, ?)",
        [id, JSON.stringify({ title, description, ingredients, instructions, notes, prep_time, servings, difficulty, category_id, image_url }), session.user.email]
      )
      await pool.query(
        `DELETE FROM recipe_versions WHERE recipe_id = ? AND id NOT IN (
          SELECT id FROM (SELECT id FROM recipe_versions WHERE recipe_id = ? ORDER BY created_at DESC LIMIT 20) t
        )`,
        [id, id]
      )
    } catch {}
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!await canEditRecipe(id, session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  await pool.query("DELETE FROM favorites WHERE recipe_id = ?", [id])
  await pool.query("DELETE FROM meal_plans WHERE recipe_id = ?", [id])
  await pool.query("UPDATE posts SET recipe_id = NULL WHERE recipe_id = ?", [id])
  await pool.query("DELETE FROM recipes WHERE id=?", [id])

  return NextResponse.json({ success: true })
}