import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const list_id = searchParams.get("list_id")

  const [collaborators] = await pool.query(
    `SELECT u.id, u.name, u.username, u.profile_image, glc.status
     FROM grocery_list_collaborators glc
     JOIN users u ON glc.user_id = u.id
     WHERE glc.grocery_list_id = ?`,
    [list_id]
  ) as any[]

  return NextResponse.json({ collaborators })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id, name FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const { list_id, username } = await req.json()

  const [lists] = await pool.query("SELECT id, name FROM grocery_lists WHERE id = ? AND user_id = ?", [list_id, me.id]) as any[]
  if (!lists[0]) return NextResponse.json({ error: "List not found or you don't own it" }, { status: 404 })

  const [users] = await pool.query("SELECT id FROM users WHERE username = ?", [username]) as any[]
  if (!users[0]) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const target = users[0]

  if (target.id === me.id) return NextResponse.json({ error: "Can't invite yourself" }, { status: 400 })

  const [f1] = await pool.query("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?", [me.id, target.id]) as any[]
  const [f2] = await pool.query("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?", [target.id, me.id]) as any[]
  if (!f1[0] || !f2[0]) return NextResponse.json({ error: "You can only invite friends" }, { status: 400 })

  const [existing] = await pool.query(
    "SELECT id FROM grocery_list_collaborators WHERE grocery_list_id = ? AND user_id = ?",
    [list_id, target.id]
  ) as any[]
  if (existing[0]) return NextResponse.json({ error: "Already invited" }, { status: 400 })

  await pool.query(
    "INSERT INTO grocery_list_collaborators (grocery_list_id, user_id, invited_by, status) VALUES (?, ?, ?, 'pending')",
    [list_id, target.id, me.id]
  )

  await pool.query(
    "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'grocery_invite', ?, ?)",
    [
      target.id,
      `${me.name} invited you to collaborate on "${lists[0].name}"`,
      JSON.stringify({ list_id, list_name: lists[0].name, invited_by: me.id, invited_by_name: me.name }),
    ]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const { list_id, user_id } = await req.json()

  if (user_id === "self") {
    await pool.query(
      "DELETE FROM grocery_list_collaborators WHERE grocery_list_id = ? AND user_id = ?",
      [list_id, me.id]
    )
  } else {
    const [lists] = await pool.query("SELECT id FROM grocery_lists WHERE id = ? AND user_id = ?", [list_id, me.id]) as any[]
    if (!lists[0]) return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    await pool.query(
      "DELETE FROM grocery_list_collaborators WHERE grocery_list_id = ? AND user_id = ?",
      [list_id, user_id]
    )
    await pool.query(
      "UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND type = 'grocery_invite' AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.list_id')) = ?",
      [user_id, String(list_id)]
    )
  }

  return NextResponse.json({ success: true })
}
