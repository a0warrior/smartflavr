import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { title, cover_emoji, cover_color, cover_image } = await req.json()

  await pool.query(
    "UPDATE cookbooks SET title=?, cover_emoji=?, cover_color=?, cover_image=? WHERE id=?",
    [title, cover_emoji, cover_color, cover_image || null, id]
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