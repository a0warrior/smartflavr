import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, checked } = await req.json()

  await pool.query(
    "UPDATE grocery_list_items SET checked = ? WHERE id = ?",
    [checked ? 1 : 0, id]
  )

  return NextResponse.json({ success: true })
}