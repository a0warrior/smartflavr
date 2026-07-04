import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { item_id, checked } = await req.json()

  await pool.query(
    `UPDATE grocery_list_items SET checked = ?
     WHERE id = ? AND grocery_list_id = (
       SELECT id FROM grocery_lists WHERE share_token = ?
     )`,
    [checked ? 1 : 0, item_id, token]
  )

  return NextResponse.json({ success: true })
}
