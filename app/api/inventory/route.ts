import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await pool.query(
    "DELETE FROM inventory_items WHERE user_id = ? AND in_stock = 0 AND used_at < DATE_SUB(NOW(), INTERVAL 10 DAY)",
    [users[0].id]
  )

  const [items]: any = await pool.query(
    "SELECT * FROM inventory_items WHERE user_id = ? ORDER BY category, name",
    [users[0].id]
  )

  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { items } = await req.json()
  for (const item of items) {
    await pool.query(
      "INSERT INTO inventory_items (user_id, name, quantity, category, in_stock) VALUES (?, ?, ?, ?, 1)",
      [users[0].id, item.name, item.quantity || "", item.category || "Pantry"]
    )
  }

  return NextResponse.json({ success: true })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, in_stock } = await req.json()

  await pool.query(
    "UPDATE inventory_items SET in_stock = ?, used_at = ? WHERE id = ?",
    [in_stock, in_stock === 0 ? new Date() : null, id]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  await pool.query("DELETE FROM inventory_items WHERE id = ?", [id])

  return NextResponse.json({ success: true })
}