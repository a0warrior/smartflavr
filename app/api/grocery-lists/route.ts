import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const [lists] = await pool.query(
    "SELECT * FROM grocery_lists WHERE user_id = ? ORDER BY created_at DESC",
    [currentUser[0].id]
  ) as any[]

  const listsWithItems = await Promise.all(lists.map(async (list: any) => {
    const [items] = await pool.query(
      "SELECT * FROM grocery_list_items WHERE grocery_list_id = ? ORDER BY sort_order ASC, id ASC",
      [list.id]
    ) as any[]
    return { ...list, items }
  }))

  return NextResponse.json({ lists: listsWithItems })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { name, items } = await req.json()

  const [result] = await pool.query(
    "INSERT INTO grocery_lists (user_id, name) VALUES (?, ?)",
    [currentUser[0].id, name]
  ) as any[]

  const listId = result.insertId

  if (items && items.length > 0) {
    await Promise.all(items.map((ingredient: string, index: number) =>
      pool.query(
        "INSERT INTO grocery_list_items (grocery_list_id, ingredient, sort_order) VALUES (?, ?, ?)",
        [listId, ingredient.trim(), index]
      )
    ))
  }

  return NextResponse.json({ success: true, id: listId })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { id, name, addItems, deleteItemIds, reorderItems } = await req.json()

  // Verify ownership
  const [lists] = await pool.query(
    "SELECT id FROM grocery_lists WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  ) as any[]

  if (!lists[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Rename if needed
  if (name !== undefined) {
    await pool.query("UPDATE grocery_lists SET name = ? WHERE id = ?", [name, id])
  }

  // Add new items
  if (addItems && addItems.length > 0) {
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as count FROM grocery_list_items WHERE grocery_list_id = ?",
      [id]
    ) as any[]
    const startOrder = countResult[0].count
    await Promise.all(addItems.map((ingredient: string, index: number) =>
      pool.query(
        "INSERT INTO grocery_list_items (grocery_list_id, ingredient, sort_order) VALUES (?, ?, ?)",
        [id, ingredient.trim(), startOrder + index]
      )
    ))
  }

  // Delete items
  if (deleteItemIds && deleteItemIds.length > 0) {
    await Promise.all(deleteItemIds.map((itemId: number) =>
      pool.query("DELETE FROM grocery_list_items WHERE id = ? AND grocery_list_id = ?", [itemId, id])
    ))
  }

  // Reorder items — expects array of { id, sort_order }
  if (reorderItems && reorderItems.length > 0) {
    await Promise.all(reorderItems.map((item: { id: number, sort_order: number }) =>
      pool.query(
        "UPDATE grocery_list_items SET sort_order = ? WHERE id = ? AND grocery_list_id = ?",
        [item.sort_order, item.id, id]
      )
    ))
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  const { id } = await req.json()

  await pool.query(
    "DELETE FROM grocery_lists WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}