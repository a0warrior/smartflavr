import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

const OWNER_EMAIL = process.env.OWNER_EMAIL

async function isAdmin(email: string) {
  const [users]: any = await pool.query(
    "SELECT is_admin FROM users WHERE email = ?",
    [email]
  )
  return users.length > 0 && users[0].is_admin === 1
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!await isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { user_id, is_admin, status, timeout_minutes } = await req.json()

  const [targetRows]: any = await pool.query("SELECT email, is_admin FROM users WHERE id = ?", [user_id])

  // Protect the owner from any modification by other admins
  if (targetRows.length > 0 && targetRows[0].email === OWNER_EMAIL && session.user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "This account cannot be modified." }, { status: 403 })
  }

  // Admins cannot moderate other admins — only the owner can act on an
  // existing admin account (ban, suspend, timeout, or remove their admin
  // status). Promoting a non-admin user is unaffected.
  if (targetRows.length > 0 && targetRows[0].is_admin === 1 && session.user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "Admins cannot moderate other admins." }, { status: 403 })
  }

  if (status !== undefined) {
    await pool.query("UPDATE users SET status = ? WHERE id = ?", [status, user_id])
  }

  if (is_admin !== undefined) {
    await pool.query("UPDATE users SET is_admin = ? WHERE id = ?", [is_admin, user_id])
  }

  if (timeout_minutes !== undefined) {
    if (timeout_minutes > 0) {
      await pool.query(
        "UPDATE users SET post_timeout_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?",
        [timeout_minutes, user_id]
      )
    } else {
      await pool.query("UPDATE users SET post_timeout_until = NULL WHERE id = ?", [user_id])
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!await isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { user_id } = await req.json()

  const [target]: any = await pool.query("SELECT email, is_admin FROM users WHERE id = ?", [user_id])
  if (target.length > 0 && target[0].email === session.user.email) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
  }
  if (target.length > 0 && target[0].email === OWNER_EMAIL) {
    return NextResponse.json({ error: "This account cannot be deleted." }, { status: 403 })
  }
  if (target.length > 0 && target[0].is_admin === 1 && session.user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "Admins cannot moderate other admins." }, { status: 403 })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Grocery list items (via the user's grocery lists)
    await conn.query(
      "DELETE gli FROM grocery_list_items gli JOIN grocery_lists gl ON gli.grocery_list_id = gl.id WHERE gl.user_id = ?",
      [user_id]
    )
    await conn.query("DELETE FROM grocery_lists WHERE user_id = ?", [user_id])

    // Post-related (likes and comments on this user's posts, plus their own likes/comments)
    await conn.query(
      "DELETE pl FROM post_likes pl JOIN posts p ON pl.post_id = p.id WHERE p.user_id = ?",
      [user_id]
    )
    await conn.query(
      "DELETE pc FROM post_comments pc JOIN posts p ON pc.post_id = p.id WHERE p.user_id = ?",
      [user_id]
    )
    await conn.query("DELETE FROM post_likes WHERE user_id = ?", [user_id])
    await conn.query("DELETE FROM post_comments WHERE user_id = ?", [user_id])
    await conn.query("DELETE FROM posts WHERE user_id = ?", [user_id])

    // Recipes (via the user's cookbooks, and directly owned)
    await conn.query(
      "DELETE r FROM recipes r JOIN cookbooks c ON r.cookbook_id = c.id WHERE c.user_id = ?",
      [user_id]
    )
    await conn.query("DELETE FROM recipes WHERE user_id = ?", [user_id])

    // Collaborators
    await conn.query("DELETE FROM cookbook_collaborators WHERE user_id = ? OR invited_by = ?", [user_id, user_id])

    // Cookbooks
    await conn.query("DELETE FROM cookbooks WHERE user_id = ?", [user_id])

    // Meal plans
    await conn.query("DELETE FROM meal_plans WHERE user_id = ?", [user_id])
    await conn.query("DELETE FROM meal_plan_categories WHERE user_id = ?", [user_id])

    // Inventory
    await conn.query("DELETE FROM inventory_items WHERE user_id = ?", [user_id])

    // Favorites
    await conn.query("DELETE FROM favorites WHERE user_id = ?", [user_id])

    // Follows (both directions)
    await conn.query("DELETE FROM follows WHERE follower_id = ? OR following_id = ?", [user_id, user_id])

    // Notifications
    await conn.query("DELETE FROM notifications WHERE user_id = ?", [user_id])

    // Privacy settings
    await conn.query("DELETE FROM user_privacy WHERE user_id = ?", [user_id])

    // Free up their invite code
    await conn.query("UPDATE invite_codes SET used_by = NULL WHERE used_by = ?", [user_id])

    // Finally, the user
    await conn.query("DELETE FROM users WHERE id = ?", [user_id])

    await conn.commit()
    return NextResponse.json({ success: true })
  } catch (err) {
    await conn.rollback()
    console.error("Delete user error:", err)
    return NextResponse.json({ error: "Could not delete this user. Check the server logs for details." }, { status: 500 })
  } finally {
    conn.release()
  }
}