import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") || ""
  const like = `%${query}%`

  const [currentUser]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )
  const currentUserId = currentUser[0]?.id

  const [cookbooks]: any = await pool.query(
    `SELECT
      cookbooks.id,
      cookbooks.title,
      cookbooks.cover_emoji,
      cookbooks.cover_image,
      cookbooks.cover_color,
      users.name AS owner_name,
      users.username AS owner_username,
      users.profile_image AS owner_image,
      COUNT(DISTINCT recipes.id) AS recipe_count
    FROM cookbooks
    LEFT JOIN users ON cookbooks.user_id = users.id
    LEFT JOIN recipes ON recipes.cookbook_id = cookbooks.id
    WHERE cookbooks.is_public = 1
      AND users.username IS NOT NULL
      AND (cookbooks.title LIKE ? OR users.name LIKE ? OR users.username LIKE ?)
    GROUP BY cookbooks.id
    ORDER BY recipe_count DESC, cookbooks.created_at DESC
    LIMIT 24`,
    [like, like, like]
  )

  const [users]: any = await pool.query(
    `SELECT
      users.id,
      users.name,
      users.username,
      users.bio,
      users.profile_image,
      COUNT(DISTINCT follows.id) AS follower_count,
      COUNT(DISTINCT cookbooks.id) AS cookbook_count
    FROM users
    LEFT JOIN follows ON follows.following_id = users.id
    LEFT JOIN cookbooks ON cookbooks.user_id = users.id AND cookbooks.is_public = 1
    WHERE users.id != ?
      AND users.username IS NOT NULL
      AND (users.name LIKE ? OR users.username LIKE ? OR users.bio LIKE ?)
    GROUP BY users.id
    ORDER BY follower_count DESC, cookbook_count DESC
    LIMIT 20`,
    [currentUserId, like, like, like]
  )

  const [recipes]: any = await pool.query(
    `SELECT
      recipes.id,
      recipes.title,
      recipes.image_url,
      recipes.prep_time,
      recipes.difficulty,
      cookbooks.id AS cookbook_id,
      cookbooks.title AS cookbook_title,
      users.name AS owner_name,
      users.username AS owner_username,
      users.profile_image AS owner_image
    FROM recipes
    JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
    JOIN users ON cookbooks.user_id = users.id
    WHERE cookbooks.is_public = 1
      AND users.username IS NOT NULL
      AND (recipes.title LIKE ? OR recipes.description LIKE ?)
    ORDER BY recipes.title ASC
    LIMIT 20`,
    [like, like]
  )

  // Trending recipes — only fetched for the default (no-query) view
  let trendingRecipes: any[] = []
  if (!query) {
    const [tr]: any = await pool.query(
      `SELECT
        recipes.id,
        recipes.title,
        recipes.image_url,
        recipes.prep_time,
        recipes.difficulty,
        cookbooks.id AS cookbook_id,
        cookbooks.title AS cookbook_title,
        users.name AS owner_name,
        users.username AS owner_username,
        users.profile_image AS owner_image,
        COUNT(DISTINCT favorites.id) AS fav_count
      FROM recipes
      JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
      JOIN users ON cookbooks.user_id = users.id
      LEFT JOIN favorites ON favorites.recipe_id = recipes.id
      WHERE cookbooks.is_public = 1 AND users.username IS NOT NULL
      GROUP BY recipes.id
      ORDER BY fav_count DESC, recipes.created_at DESC
      LIMIT 8`
    )
    trendingRecipes = tr
  }

  return NextResponse.json({ cookbooks, users, recipes, trendingRecipes })
}
