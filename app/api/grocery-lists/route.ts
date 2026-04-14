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
      "SELECT * FROM grocery_list_items WHERE grocery_list_id = ? ORDER BY id ASC",
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
    await Promise.all(items.map((ingredient: string) =>
      pool.query(
        "INSERT INTO grocery_list_items (grocery_list_id, ingredient) VALUES (?, ?)",
        [listId, ingredient]
      )
    ))
  }

  return NextResponse.json({ success: true, id: listId })
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