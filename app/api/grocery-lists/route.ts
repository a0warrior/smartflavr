import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

// Household (non-food) items live on grocery lists but stay out of the kitchen inventory
async function ensureHouseholdColumn() {
  try {
    await pool.query("ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS is_household TINYINT(1) NOT NULL DEFAULT 0")
  } catch {}
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]

  await ensureHouseholdColumn()
  const [lists] = await pool.query(
    `SELECT gl.*, NULL as shared_by
     FROM grocery_lists gl
     WHERE gl.user_id = ?
     UNION ALL
     SELECT gl.*, u.name as shared_by
     FROM grocery_lists gl
     JOIN grocery_list_collaborators glc ON glc.grocery_list_id = gl.id AND glc.user_id = ? AND glc.status = 'accepted'
     JOIN users u ON u.id = gl.user_id
     ORDER BY created_at DESC`,
    [currentUser[0].id, currentUser[0].id]
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

  const { id, name, addItems, deleteItemIds, reorderItems, household, setHousehold } = await req.json()
  await ensureHouseholdColumn()

  // Verify ownership or accepted collaboration
  const [lists] = await pool.query(
    `SELECT gl.id FROM grocery_lists gl
     LEFT JOIN grocery_list_collaborators glc ON glc.grocery_list_id = gl.id AND glc.user_id = ? AND glc.status = 'accepted'
     WHERE gl.id = ? AND (gl.user_id = ? OR glc.id IS NOT NULL)`,
    [currentUser[0].id, id, currentUser[0].id]
  ) as any[]

  if (!lists[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Rename if needed
  if (name !== undefined) {
    await pool.query("UPDATE grocery_lists SET name = ? WHERE id = ?", [name, id])
  }

  // Add new items — always after the current highest sort_order, not a
  // count of remaining rows (which under-counts once items are deleted,
  // handing new items a lower order than items already in the list).
  if (addItems && addItems.length > 0) {
    const [maxResult] = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM grocery_list_items WHERE grocery_list_id = ?",
      [id]
    ) as any[]
    const startOrder = maxResult[0].maxOrder + 1
    await Promise.all(addItems.map((ingredient: string, index: number) =>
      pool.query(
        "INSERT INTO grocery_list_items (grocery_list_id, ingredient, sort_order, is_household) VALUES (?, ?, ?, ?)",
        [id, ingredient.trim(), startOrder + index, household ? 1 : 0]
      )
    ))
  }

  // Move an item between food and household
  if (setHousehold && setHousehold.id !== undefined) {
    await pool.query(
      "UPDATE grocery_list_items SET is_household = ? WHERE id = ? AND grocery_list_id = ?",
      [setHousehold.is_household ? 1 : 0, setHousehold.id, id]
    )
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