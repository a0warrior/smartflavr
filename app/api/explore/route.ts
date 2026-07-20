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
  const type = searchParams.get("type") || "" // "cookbooks" | "recipes" | "people" | ""
  const like = `%${query}%`

  const [currentUser]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  )
  const currentUserId = currentUser[0]?.id

  // Limits: full-page views get 100, default discover view gets 4, search gets 20
  const isFullPage = !!type && !query
  const cookbookLimit = isFullPage ? 100 : query ? 20 : 4
  const userLimit = isFullPage ? 100 : query ? 20 : 4
  const recipeLimit = isFullPage ? 100 : query ? 20 : 6

  let cookbooks: any[] = []
  if (!type || type === "cookbooks") {
    const [rows]: any = await pool.query(
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
      LEFT JOIN user_privacy up ON up.user_id = cookbooks.user_id
      WHERE cookbooks.is_public = 1
        AND users.username IS NOT NULL
        AND COALESCE(up.show_on_explore, 1) = 1
        AND (cookbooks.title LIKE ? OR users.name LIKE ? OR users.username LIKE ?)
      GROUP BY cookbooks.id
      ORDER BY recipe_count DESC, cookbooks.created_at DESC
      LIMIT ${cookbookLimit}`,
      [like, like, like]
    )
    cookbooks = rows
  }

  let users: any[] = []
  if (!type || type === "people") {
    const [rows]: any = await pool.query(
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
      LEFT JOIN user_privacy up ON up.user_id = users.id
      WHERE users.id != ?
        AND users.username IS NOT NULL
        AND COALESCE(up.show_on_explore, 1) = 1
        AND COALESCE(up.appear_in_suggestions, 1) = 1
        AND (users.name LIKE ? OR users.username LIKE ? OR users.bio LIKE ?)
      GROUP BY users.id
      ORDER BY follower_count DESC, cookbook_count DESC
      LIMIT ${userLimit}`,
      [currentUserId, like, like, like]
    )
    users = rows
  }

  // Recipes visible to the public: from public cookbooks OR posted to the feed from a private cookbook,
  // and only from owners who haven't opted out of Explore
  const publicRecipeWhere = `(
    cookbooks.is_public = 1
    OR EXISTS (SELECT 1 FROM posts WHERE posts.recipe_id = recipes.id AND posts.visibility = 'everyone')
  )
  AND COALESCE((SELECT show_on_explore FROM user_privacy WHERE user_privacy.user_id = cookbooks.user_id), 1) = 1`

  // Recipe search (only when actively searching)
  let recipes: any[] = []
  if (query && (!type || type === "recipes")) {
    const [rows]: any = await pool.query(
      `SELECT
        recipes.id,
        recipes.title,
        recipes.image_url,
        recipes.prep_time,
        recipes.difficulty,
        cookbooks.id AS cookbook_id,
        cookbooks.title AS cookbook_title,
        cookbooks.is_public AS cookbook_is_public,
        users.name AS owner_name,
        users.username AS owner_username,
        users.profile_image AS owner_image
      FROM recipes
      JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
      JOIN users ON cookbooks.user_id = users.id
      WHERE users.username IS NOT NULL
        AND ${publicRecipeWhere}
        AND (recipes.title LIKE ? OR recipes.description LIKE ?)
      ORDER BY recipes.title ASC
      LIMIT ${recipeLimit}`,
      [like, like]
    )
    recipes = rows
  }

  // Trending recipes — for discover view and full recipes page
  let trendingRecipes: any[] = []
  if (!type || type === "recipes") {
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
          cookbooks.is_public AS cookbook_is_public,
          users.name AS owner_name,
          users.username AS owner_username,
          users.profile_image AS owner_image,
          COUNT(DISTINCT favorites.id) AS fav_count
        FROM recipes
        JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
        JOIN users ON cookbooks.user_id = users.id
        LEFT JOIN favorites ON favorites.recipe_id = recipes.id
        WHERE users.username IS NOT NULL AND ${publicRecipeWhere}
        GROUP BY recipes.id
        ORDER BY fav_count DESC, recipes.created_at DESC
        LIMIT ${recipeLimit}`
      )
      trendingRecipes = tr
    }
  }

  return NextResponse.json({ cookbooks, users, recipes, trendingRecipes })
}
