import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const [rows] = await pool.query(
    `SELECT mpc.id, mpc.owner_user_id, mpc.collaborator_user_id, mpc.status,
     u1.name as owner_name, u1.username as owner_username, u1.profile_image as owner_image,
     u2.name as collab_name, u2.username as collab_username, u2.profile_image as collab_image
     FROM meal_plan_collaborators mpc
     JOIN users u1 ON mpc.owner_user_id = u1.id
     JOIN users u2 ON mpc.collaborator_user_id = u2.id
     WHERE mpc.owner_user_id = ? OR mpc.collaborator_user_id = ?`,
    [me.id, me.id]
  ) as any[]

  const syncs = (rows as any[]).map((row: any) => {
    const isOwner = row.owner_user_id === me.id
    return {
      id: row.id,
      status: row.status,
      isOwner,
      partner: {
        id: isOwner ? row.collaborator_user_id : row.owner_user_id,
        name: isOwner ? row.collab_name : row.owner_name,
        username: isOwner ? row.collab_username : row.owner_username,
        profile_image: isOwner ? row.collab_image : row.owner_image,
      },
    }
  })

  return NextResponse.json({ syncs })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id, name FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const { username } = await req.json()

  const [users] = await pool.query("SELECT id FROM users WHERE username = ?", [username]) as any[]
  if (!users[0]) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const target = users[0]

  if (target.id === me.id) return NextResponse.json({ error: "Can't sync with yourself" }, { status: 400 })

  const [f1] = await pool.query("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?", [me.id, target.id]) as any[]
  const [f2] = await pool.query("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?", [target.id, me.id]) as any[]
  if (!f1[0] || !f2[0]) return NextResponse.json({ error: "You can only sync with friends" }, { status: 400 })

  const [existing] = await pool.query(
    `SELECT id FROM meal_plan_collaborators
     WHERE (owner_user_id = ? AND collaborator_user_id = ?) OR (owner_user_id = ? AND collaborator_user_id = ?)`,
    [me.id, target.id, target.id, me.id]
  ) as any[]
  if (existing[0]) return NextResponse.json({ error: "Already synced or invite pending" }, { status: 400 })

  await pool.query(
    "INSERT INTO meal_plan_collaborators (owner_user_id, collaborator_user_id, status) VALUES (?, ?, 'pending')",
    [me.id, target.id]
  )

  await pool.query(
    "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'meal_plan_invite', ?, ?)",
    [
      target.id,
      `${me.name} wants to sync meal plans with you`,
      JSON.stringify({ owner_user_id: me.id, invited_by_name: me.name }),
    ]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [currentUser] = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email]) as any[]
  const me = currentUser[0]

  const { sync_id } = await req.json()

  const [rows] = await pool.query(
    "SELECT id FROM meal_plan_collaborators WHERE id = ? AND (owner_user_id = ? OR collaborator_user_id = ?)",
    [sync_id, me.id, me.id]
  ) as any[]
  if (!(rows as any[])[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await pool.query("DELETE FROM meal_plan_collaborators WHERE id = ?", [sync_id])

  return NextResponse.json({ success: true })
}
