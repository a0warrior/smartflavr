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
    "SELECT id, name FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const [targetUser] = await pool.query(
    "SELECT id, name FROM users WHERE username = ?",
    [username]
  ) as any[]

  if (currentUser.length === 0 || targetUser.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const currentId = currentUser[0].id
  const targetId = targetUser[0].id

  // Check if they were mutual friends before unfollowing
  const [followedBack] = await pool.query(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
    [targetId, currentId]
  ) as any[]

  const wasFriend = followedBack.length > 0

  // Remove the follow
  await pool.query(
    "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
    [currentId, targetId]
  )

  if (wasFriend) {
    // Find all cookbooks owned by currentUser where targetUser is a collaborator
    const [collabsAsOwner] = await pool.query(
      `SELECT cc.id as collab_id, cc.cookbook_id, c.title as cookbook_title
       FROM cookbook_collaborators cc
       JOIN cookbooks c ON cc.cookbook_id = c.id
       WHERE c.user_id = ? AND cc.user_id = ? AND cc.status = 'accepted'`,
      [currentId, targetId]
    ) as any[]

    // Find all cookbooks owned by targetUser where currentUser is a collaborator
    const [collabsAsGuest] = await pool.query(
      `SELECT cc.id as collab_id, cc.cookbook_id, c.title as cookbook_title, c.user_id as owner_id
       FROM cookbook_collaborators cc
       JOIN cookbooks c ON cc.cookbook_id = c.id
       WHERE c.user_id = ? AND cc.user_id = ? AND cc.status = 'accepted'`,
      [targetId, currentId]
    ) as any[]

    // Remove targetUser from currentUser's cookbooks
    for (const collab of collabsAsOwner) {
      await pool.query(
        "DELETE FROM cookbook_collaborators WHERE id = ?",
        [collab.collab_id]
      )
      // Notify targetUser they were removed
      await pool.query(
        "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'collab_removed', ?, ?)",
        [
          targetId,
          `You were removed from "${collab.cookbook_title}" because you are no longer friends with the owner`,
          JSON.stringify({ cookbook_id: collab.cookbook_id })
        ]
      )
    }

    // Remove currentUser from targetUser's cookbooks
    for (const collab of collabsAsGuest) {
      await pool.query(
        "DELETE FROM cookbook_collaborators WHERE id = ?",
        [collab.collab_id]
      )
      // Notify targetUser (owner) that currentUser was removed
      await pool.query(
        "INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'collab_removed', ?, ?)",
        [
          collab.owner_id,
          `${currentUser[0].name} was removed from "${collab.cookbook_title}" because they are no longer friends`,
          JSON.stringify({ cookbook_id: collab.cookbook_id })
        ]
      )
    }
  }

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