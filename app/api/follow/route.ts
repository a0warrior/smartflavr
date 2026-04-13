import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { username } = await req.json()

  const [currentUser]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  const [targetUser]: any = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  )

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

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { username } = await req.json()

  const [currentUser]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  const [targetUser]: any = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  )

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

  const [currentUser]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )

  const [targetUser]: any = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [username]
  )

  if (currentUser.length === 0 || targetUser.length === 0) {
    return NextResponse.json({ isFollowing: false, isFriend: false })
  }

  const [following]: any = await pool.query(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
    [currentUser[0].id, targetUser[0].id]
  )

  const [followedBack]: any = await pool.query(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
    [targetUser[0].id, currentUser[0].id]
  )

  return NextResponse.json({
    isFollowing: following.length > 0,
    isFriend: following.length > 0 && followedBack.length > 0
  })
}