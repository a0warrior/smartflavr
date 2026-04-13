import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cookbook_id = searchParams.get("cookbook_id")

  const [collaborators] = await pool.query(
    `SELECT users.id, users.name, users.username, users.profile_image, cookbook_collaborators.status
     FROM cookbook_collaborators
     LEFT JOIN users ON cookbook_collaborators.user_id = users.id
     WHERE cookbook_collaborators.cookbook_id = ?`,
    [cookbook_id]
  ) as any[]

  return NextResponse.json({ collaborators })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id, name FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { cookbook_id, username } = await req.json()

  const [cookbook] = await pool.query(
    "SELECT id, title FROM cookbooks WHERE id = ? AND user_id = ?",
    [cookbook_id, currentUser[0].id]
  ) as any[]

  if (!cookbook || cookbook.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  const [targetUser] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  ) as any[]

  if (!targetUser || targetUser.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const [following] = await pool.query(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
    [currentUser[0].id, targetUser[0].id]
  ) as any[]

  const [followedBack] = await pool.query(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
    [targetUser[0].id, currentUser[0].id]
  ) as any[]

  if (following.length === 0 || followedBack.length === 0) {
    return NextResponse.json({ error: "You can only invite friends (mutual follows)" }, { status: 400 })
  }

  const [existing] = await pool.query(
    "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ?",
    [cookbook_id, targetUser[0].id]
  ) as any[]

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "User already invited" }, { status: 400 })
  }

  await pool.query(
    "INSERT INTO cookbook_collaborators (cookbook_id, user_id, invited_by, status) VALUES (?, ?, ?, 'pending')",
    [cookbook_id, targetUser[0].id, currentUser[0].id]
  )

  await pool.query(
    `INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'collab_invite', ?, ?)`,
    [
      targetUser[0].id,
      `${currentUser[0].name} invited you to collaborate on "${cookbook[0].title}"`,
      JSON.stringify({ cookbook_id: cookbook[0].id, cookbook_title: cookbook[0].title, invited_by: currentUser[0].name })
    ]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { cookbook_id, user_id } = await req.json()

  const [cookbook] = await pool.query(
    "SELECT id FROM cookbooks WHERE id = ? AND user_id = ?",
    [cookbook_id, currentUser[0].id]
  ) as any[]

  if (!cookbook || cookbook.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  await pool.query(
    "DELETE FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ?",
    [cookbook_id, user_id]
  )

  return NextResponse.json({ success: true })
}