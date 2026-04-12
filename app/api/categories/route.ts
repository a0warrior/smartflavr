import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cookbook_id = searchParams.get("cookbook_id")

  const [categories]: any = await pool.query(
    "SELECT * FROM categories WHERE cookbook_id = ? ORDER BY created_at ASC",
    [cookbook_id]
  )

  return NextResponse.json({ categories })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { cookbook_id, name, emoji } = await req.json()

  await pool.query(
    "INSERT INTO categories (cookbook_id, name, emoji) VALUES (?, ?, ?)",
    [cookbook_id, name, emoji || "📋"]
  )

  return NextResponse.json({ success: true })
}