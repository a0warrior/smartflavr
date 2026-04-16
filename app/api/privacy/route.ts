import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const userId = users[0].id
  const body = await req.json()

  const {
    profile_visibility,
    cookbook_visibility,
    show_on_explore,
    who_can_follow,
    who_can_collab,
    show_follower_count,
    notify_new_follower,
    notify_collab_invite,
    notify_new_recipe,
    notify_collab_removed,
    show_recent_recipes,
    show_favorites,
    appear_in_suggestions,
  } = body

  await pool.query(`
    INSERT INTO user_privacy (
      user_id, profile_visibility, cookbook_visibility, show_on_explore,
      who_can_follow, who_can_collab, show_follower_count,
      notify_new_follower, notify_collab_invite, notify_new_recipe, notify_collab_removed,
      show_recent_recipes, show_favorites, appear_in_suggestions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      profile_visibility = VALUES(profile_visibility),
      cookbook_visibility = VALUES(cookbook_visibility),
      show_on_explore = VALUES(show_on_explore),
      who_can_follow = VALUES(who_can_follow),
      who_can_collab = VALUES(who_can_collab),
      show_follower_count = VALUES(show_follower_count),
      notify_new_follower = VALUES(notify_new_follower),
      notify_collab_invite = VALUES(notify_collab_invite),
      notify_new_recipe = VALUES(notify_new_recipe),
      notify_collab_removed = VALUES(notify_collab_removed),
      show_recent_recipes = VALUES(show_recent_recipes),
      show_favorites = VALUES(show_favorites),
      appear_in_suggestions = VALUES(appear_in_suggestions)
  `, [
    userId,
    profile_visibility, cookbook_visibility, show_on_explore ? 1 : 0,
    who_can_follow, who_can_collab, show_follower_count ? 1 : 0,
    notify_new_follower ? 1 : 0, notify_collab_invite ? 1 : 0,
    notify_new_recipe ? 1 : 0, notify_collab_removed ? 1 : 0,
    show_recent_recipes ? 1 : 0, show_favorites ? 1 : 0, appear_in_suggestions ? 1 : 0,
  ])

  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const [rows]: any = await pool.query("SELECT * FROM user_privacy WHERE user_id = ?", [users[0].id])

  return NextResponse.json({ privacy: rows[0] || null })
}