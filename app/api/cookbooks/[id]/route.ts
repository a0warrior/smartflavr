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
  const { title, cover_emoji, cover_color, cover_image, is_public } = await req.json()

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
  await pool.query("DELETE FROM cookbooks WHERE id=?", [id])

  return NextResponse.json({ success: true })
}