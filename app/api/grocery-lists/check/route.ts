import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (!currentUser[0]) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, checked } = await req.json()

  // Only the list owner or an accepted collaborator may check off items on it
  const [rows]: any = await pool.query(
    `SELECT gli.id FROM grocery_list_items gli
     JOIN grocery_lists gl ON gl.id = gli.grocery_list_id
     LEFT JOIN grocery_list_collaborators glc ON glc.grocery_list_id = gl.id AND glc.user_id = ? AND glc.status = 'accepted'
     WHERE gli.id = ? AND (gl.user_id = ? OR glc.id IS NOT NULL)`,
    [currentUser[0].id, id, currentUser[0].id]
  )
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await pool.query(
    "UPDATE grocery_list_items SET checked = ? WHERE id = ?",
    [checked ? 1 : 0, id]
  )

  return NextResponse.json({ success: true })
}