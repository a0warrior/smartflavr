import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [cookbooks]: any = await pool.query(
    "SELECT * FROM cookbooks WHERE id = ?",
    [id]
  )
  if (cookbooks.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ cookbook: cookbooks[0] })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  if ("is_pinned" in body) {
    await pool.query("UPDATE cookbooks SET is_pinned=? WHERE id=?", [body.is_pinned ? 1 : 0, id])
    return NextResponse.json({ success: true })
  }

  const { title, cover_emoji, cover_color, cover_image, is_public } = body
  await pool.query(
    "UPDATE cookbooks SET title=?, cover_emoji=?, cover_color=?, cover_image=?, is_public=? WHERE id=?",
    [title, cover_emoji, cover_color, cover_image || null, is_public ?? 0, id]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Cascade: clean up everything inside the cookbook before deleting it
  const [recipes]: any = await pool.query("SELECT id FROM recipes WHERE cookbook_id = ?", [id])
  if (recipes.length > 0) {
    const recipeIds = recipes.map((r: any) => r.id)
    await pool.query("DELETE FROM favorites WHERE recipe_id IN (?)", [recipeIds])
    await pool.query("DELETE FROM meal_plans WHERE recipe_id IN (?)", [recipeIds])
    await pool.query("UPDATE posts SET recipe_id = NULL WHERE recipe_id IN (?)", [recipeIds])
  }
  await pool.query("DELETE FROM recipes WHERE cookbook_id = ?", [id])
  await pool.query("DELETE FROM cookbook_collaborators WHERE cookbook_id = ?", [id])
  await pool.query("UPDATE posts SET cookbook_id = NULL WHERE cookbook_id = ?", [id])
  await pool.query("DELETE FROM cookbooks WHERE id = ?", [id])

  return NextResponse.json({ success: true })
}