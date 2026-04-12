import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { title, description, ingredients, instructions, notes, prep_time, servings, difficulty, sort_order, category_id, image_url } = await req.json()

  await pool.query(
    "UPDATE recipes SET title=?, description=?, ingredients=?, instructions=?, notes=?, prep_time=?, servings=?, difficulty=?, sort_order=?, category_id=?, image_url=? WHERE id=?",
    [title, description, ingredients, instructions, notes, prep_time, servings, difficulty, sort_order || 0, category_id || null, image_url || null, id]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  await pool.query("DELETE FROM recipes WHERE id=?", [id])

  return NextResponse.json({ success: true })
}