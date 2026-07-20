import pool from "@/lib/db"

// Per-recipe cooking progress (current step + checked ingredients), saved
// server-side so it survives closing the tab/app mid-cook — mirrors the
// cook_timers persistence pattern in lib/cookTimers.ts. One row per
// (user, recipe): starting to cook the same recipe again just overwrites it.
async function ensureTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS cook_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      cookbook_id INT NOT NULL,
      recipe_id INT NOT NULL,
      step_index INT NOT NULL DEFAULT 0,
      checked_ingredients TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_recipe (user_id, recipe_id)
    )`)
  } catch {}
}

export async function getCookSessions(userId: number, cookbookId: number) {
  await ensureTable()
  // Abandoned sessions (never finished, never revisited) don't need to
  // linger forever — a week is generous for "I'll get back to this."
  await pool.query("DELETE FROM cook_sessions WHERE updated_at < NOW() - INTERVAL 7 DAY").catch(() => {})
  const [rows]: any = await pool.query(
    "SELECT recipe_id, step_index, checked_ingredients FROM cook_sessions WHERE user_id = ? AND cookbook_id = ?",
    [userId, cookbookId]
  )
  return rows.map((r: any) => {
    let checked: number[] = []
    try { checked = JSON.parse(r.checked_ingredients || "[]") } catch {}
    return { recipe_id: r.recipe_id, step_index: r.step_index, checked_ingredients: checked }
  })
}

export async function saveCookSession(userId: number, cookbookId: number, recipeId: number, stepIndex: number, checkedIngredients: number[]) {
  await ensureTable()
  await pool.query(
    `INSERT INTO cook_sessions (user_id, cookbook_id, recipe_id, step_index, checked_ingredients)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE cookbook_id = VALUES(cookbook_id), step_index = VALUES(step_index), checked_ingredients = VALUES(checked_ingredients), updated_at = CURRENT_TIMESTAMP`,
    [userId, cookbookId, recipeId, stepIndex, JSON.stringify(checkedIngredients)]
  )
}

export async function clearCookSession(userId: number, recipeId: number) {
  await ensureTable()
  await pool.query("DELETE FROM cook_sessions WHERE user_id = ? AND recipe_id = ?", [userId, recipeId])
}
