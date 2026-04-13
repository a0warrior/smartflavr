import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const feed = searchParams.get("feed") || "following"

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  if (!currentUser || currentUser.length === 0) {
    return NextResponse.json({ posts: [] })
  }

  const globalQuery = `SELECT 
    posts.*,
    users.name as author_name,
    users.username as author_username,
    users.profile_image as author_image,
    recipes.title as recipe_title,
    recipes.image_url as recipe_image,
    recipes.description as recipe_description,
    recipes.prep_time as recipe_prep_time,
    recipes.servings as recipe_servings,
    cookbooks.title as cookbook_title,
    cookbooks.cover_emoji as cookbook_emoji,
    cookbooks.cover_color as cookbook_color,
    cookbooks.cover_image as cookbook_cover,
    COUNT(DISTINCT post_likes.id) as like_count,
    COUNT(DISTINCT post_comments.id) as comment_count,
    MAX(CASE WHEN post_likes.user_id = ? THEN 1 ELSE 0 END) as liked_by_me
  FROM posts
  LEFT JOIN users ON posts.user_id = users.id
  LEFT JOIN recipes ON posts.recipe_id = recipes.id
  LEFT JOIN cookbooks ON posts.cookbook_id = cookbooks.id
  LEFT JOIN post_likes ON post_likes.post_id = posts.id
  LEFT JOIN post_comments ON post_comments.post_id = posts.id
  WHERE users.username IS NOT NULL
  GROUP BY posts.id
  ORDER BY posts.created_at DESC
  LIMIT 50`

  const followingQuery = `SELECT 
    posts.*,
    users.name as author_name,
    users.username as author_username,
    users.profile_image as author_image,
    recipes.title as recipe_title,
    recipes.image_url as recipe_image,
    recipes.description as recipe_description,
    recipes.prep_time as recipe_prep_time,
    recipes.servings as recipe_servings,
    cookbooks.title as cookbook_title,
    cookbooks.cover_emoji as cookbook_emoji,
    cookbooks.cover_color as cookbook_color,
    cookbooks.cover_image as cookbook_cover,
    COUNT(DISTINCT post_likes.id) as like_count,
    COUNT(DISTINCT post_comments.id) as comment_count,
    MAX(CASE WHEN post_likes.user_id = ? THEN 1 ELSE 0 END) as liked_by_me
  FROM posts
  LEFT JOIN users ON posts.user_id = users.id
  LEFT JOIN recipes ON posts.recipe_id = recipes.id
  LEFT JOIN cookbooks ON posts.cookbook_id = cookbooks.id
  LEFT JOIN post_likes ON post_likes.post_id = posts.id
  LEFT JOIN post_comments ON post_comments.post_id = posts.id
  WHERE posts.user_id = ?
    OR posts.user_id IN (
      SELECT following_id FROM follows WHERE follower_id = ?
    )
  GROUP BY posts.id
  ORDER BY posts.created_at DESC
  LIMIT 50`

  const query = feed === "global" ? globalQuery : followingQuery
  const params = feed === "global"
    ? [currentUser[0].id]
    : [currentUser[0].id, currentUser[0].id, currentUser[0].id]

  const [posts] = await pool.query(query, params) as any[]

  return NextResponse.json({ posts })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  if (!currentUser || currentUser.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const { type, content, image_url, recipe_id, cookbook_id } = await req.json()

  await pool.query(
    "INSERT INTO posts (user_id, type, content, image_url, recipe_id, cookbook_id) VALUES (?, ?, ?, ?, ?, ?)",
    [currentUser[0].id, type, content || null, image_url || null, recipe_id || null, cookbook_id || null]
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

  const { id } = await req.json()

  await pool.query(
    "DELETE FROM posts WHERE id = ? AND user_id = ?",
    [id, currentUser[0].id]
  )

  return NextResponse.json({ success: true })
}