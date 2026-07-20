import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { getPrivacy } from "@/lib/privacy"
import { sendPush } from "@/lib/push"

// Collaborators can be editors (full edit access) or viewers (can see a
// private cookbook but not change it). Lazily add the role column.
async function ensureRoleColumn() {
  try {
    await pool.query("ALTER TABLE cookbook_collaborators ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'editor'")
  } catch {}
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cookbook_id = searchParams.get("cookbook_id")

  await ensureRoleColumn()
  const [collaborators] = await pool.query(
    `SELECT users.id, users.name, users.username, users.profile_image, cookbook_collaborators.status, cookbook_collaborators.role
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

  const { cookbook_id, username, role } = await req.json()
  const collabRole = role === "viewer" ? "viewer" : "editor"
  await ensureRoleColumn()

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

  const targetPrivacy = await getPrivacy(targetUser[0].id)

  if (targetPrivacy.who_can_collab === "no_one") {
    return NextResponse.json({ error: "This user isn't accepting collaboration invites" }, { status: 403 })
  }

  if (targetPrivacy.who_can_collab === "friends") {
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
  }

  const [existing] = await pool.query(
    "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ?",
    [cookbook_id, targetUser[0].id]
  ) as any[]

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "User already invited" }, { status: 400 })
  }

  await pool.query(
    "INSERT INTO cookbook_collaborators (cookbook_id, user_id, invited_by, status, role) VALUES (?, ?, ?, 'pending', ?)",
    [cookbook_id, targetUser[0].id, currentUser[0].id, collabRole]
  )

  if (targetPrivacy.notify_collab_invite) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, data) VALUES (?, 'collab_invite', ?, ?)`,
      [
        targetUser[0].id,
        collabRole === "viewer"
          ? `${currentUser[0].name} invited you to view "${cookbook[0].title}"`
          : `${currentUser[0].name} invited you to collaborate on "${cookbook[0].title}"`,
        JSON.stringify({ cookbook_id: cookbook[0].id, cookbook_title: cookbook[0].title, invited_by: currentUser[0].name, role: collabRole })
      ]
    )
    sendPush(targetUser[0].id, {
      title: "Collaboration invite",
      body: collabRole === "viewer" ? `${currentUser[0].name} invited you to view "${cookbook[0].title}"` : `${currentUser[0].name} invited you to collaborate on "${cookbook[0].title}"`,
      url: "/dashboard",
    }).catch(() => {})
  }

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

  // Allow leaving yourself or owner removing someone
  if (user_id === "self") {
    await pool.query(
      "DELETE FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ?",
      [cookbook_id, currentUser[0].id]
    )
    return NextResponse.json({ success: true })
  }

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

  // Mark the invitee's pending collab_invite notification as read so the Accept/Decline buttons disappear
  await pool.query(
    `UPDATE notifications SET read_at = NOW()
     WHERE user_id = ? AND type = 'collab_invite' AND read_at IS NULL AND data LIKE ?`,
    [user_id, `%"cookbook_id":${cookbook_id}%`]
  )

  return NextResponse.json({ success: true })
}