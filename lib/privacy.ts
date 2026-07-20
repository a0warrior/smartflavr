import pool from "@/lib/db"

export type Privacy = {
  profile_visibility: "everyone" | "friends" | "only_me"
  cookbook_visibility: "everyone" | "friends" | "only_me"
  show_on_explore: boolean
  who_can_follow: "anyone" | "no_one"
  who_can_collab: "friends" | "anyone" | "no_one"
  show_follower_count: boolean
  notify_new_follower: boolean
  notify_collab_invite: boolean
  notify_new_recipe: boolean
  notify_collab_removed: boolean
  show_recent_recipes: boolean
  show_favorites: boolean
  appear_in_suggestions: boolean
}

// Matches the defaults the settings UI shows for a user who has never saved
// a preference — a missing row means "everything open" (not "everything
// locked down"), so existing users aren't silently hidden by this feature.
const DEFAULTS: Privacy = {
  profile_visibility: "everyone",
  cookbook_visibility: "everyone",
  show_on_explore: true,
  who_can_follow: "anyone",
  who_can_collab: "friends",
  show_follower_count: true,
  notify_new_follower: true,
  notify_collab_invite: true,
  notify_new_recipe: false,
  notify_collab_removed: true,
  show_recent_recipes: true,
  show_favorites: false,
  appear_in_suggestions: true,
}

export async function getPrivacy(userId: number): Promise<Privacy> {
  const [rows]: any = await pool.query("SELECT * FROM user_privacy WHERE user_id = ?", [userId])
  const row = rows[0]
  if (!row) return { ...DEFAULTS }
  return {
    profile_visibility: row.profile_visibility || DEFAULTS.profile_visibility,
    cookbook_visibility: row.cookbook_visibility || DEFAULTS.cookbook_visibility,
    show_on_explore: row.show_on_explore === undefined || row.show_on_explore === null ? DEFAULTS.show_on_explore : !!row.show_on_explore,
    who_can_follow: row.who_can_follow || DEFAULTS.who_can_follow,
    who_can_collab: row.who_can_collab || DEFAULTS.who_can_collab,
    show_follower_count: row.show_follower_count === undefined || row.show_follower_count === null ? DEFAULTS.show_follower_count : !!row.show_follower_count,
    notify_new_follower: row.notify_new_follower === undefined || row.notify_new_follower === null ? DEFAULTS.notify_new_follower : !!row.notify_new_follower,
    notify_collab_invite: row.notify_collab_invite === undefined || row.notify_collab_invite === null ? DEFAULTS.notify_collab_invite : !!row.notify_collab_invite,
    notify_new_recipe: row.notify_new_recipe === undefined || row.notify_new_recipe === null ? DEFAULTS.notify_new_recipe : !!row.notify_new_recipe,
    notify_collab_removed: row.notify_collab_removed === undefined || row.notify_collab_removed === null ? DEFAULTS.notify_collab_removed : !!row.notify_collab_removed,
    show_recent_recipes: row.show_recent_recipes === undefined || row.show_recent_recipes === null ? DEFAULTS.show_recent_recipes : !!row.show_recent_recipes,
    show_favorites: row.show_favorites === undefined || row.show_favorites === null ? DEFAULTS.show_favorites : !!row.show_favorites,
    appear_in_suggestions: row.appear_in_suggestions === undefined || row.appear_in_suggestions === null ? DEFAULTS.appear_in_suggestions : !!row.appear_in_suggestions,
  }
}

export async function isFriend(viewerId: number, targetId: number): Promise<boolean> {
  if (viewerId === targetId) return false
  const [rows]: any = await pool.query(
    `SELECT f1.id FROM follows f1
     JOIN follows f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id
     WHERE f1.follower_id = ? AND f1.following_id = ?`,
    [viewerId, targetId]
  )
  return rows.length > 0
}

// Applies a visibility setting ("everyone" | "friends" | "only_me") given
// whether the viewer is the profile owner and/or a mutual-follow friend.
export function isVisible(setting: "everyone" | "friends" | "only_me", isOwner: boolean, viewerIsFriend: boolean): boolean {
  if (isOwner) return true
  if (setting === "everyone") return true
  if (setting === "friends") return viewerIsFriend
  return false // only_me
}
