import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { username } = await req.json()

  const [currentUser] = await pool.query(
    "SELECT id, name FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const [targetUser] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  ) as any[]

  if (currentUser.length === 0 || targetUser.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (currentUser[0].id === targetUser[0].id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 })
  }

  await pool.query(
    "INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)",
    [currentUser[0].id, targetUser[0].id]
  )

  await pool.query(
    "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'new_follower', ?, ?)",
    [
      targetUser[0].id,
      `${currentUser[0].name} started following you`,
      JSON.stringify({ follower_id: currentUser[0].id, follower_name: currentUser[0].name })
    ]
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { username } = await req.json()

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const [targetUser] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  ) as any[]

  if (currentUser.length === 0 || targetUser.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  await pool.query(
    "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
    [currentUser[0].id, targetUser[0].id]
  )

  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const [targetUser] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  ) as any[]

  if (currentUser.length === 0 || targetUser.length === 0) {
    return NextResponse.json({ isFollowing: false, isFriend: false })
  }

  const [following] = await pool.query(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
    [currentUser[0].id, targetUser[0].id]
  ) as any[]

  const [followedBack] = await pool.query(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
    [targetUser[0].id, currentUser[0].id]
  ) as any[]

  return NextResponse.json({
    isFollowing: following.length > 0,
    isFriend: following.length > 0 && followedBack.length > 0
  })
}