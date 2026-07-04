import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [lists] = await pool.query(
    "SELECT id, name FROM grocery_lists WHERE share_token = ?",
    [token]
  ) as any[]

  if (!lists[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [items] = await pool.query(
    "SELECT id, ingredient, checked, sort_order FROM grocery_list_items WHERE grocery_list_id = ? ORDER BY sort_order ASC, id ASC",
    [lists[0].id]
  ) as any[]

  return NextResponse.json({ list: lists[0], items })
}
