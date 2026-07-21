import pool from "@/lib/db"

// Per-recipe cooking progress (current step + checked ingredients), saved
// server-side so it survives closing the tab/app mid-cook — mirrors the
// cook_timers persistence pattern in lib/cookTimers.ts. One row per
// (user, recipe): starting to cook the same recipe again just overwrites it.
//
// session_id groups recipes that were being cooked together in one
// Cooking Mode instance (e.g. via "Cook another"). Reopening a recipe that
// still has a session_id lets Cooking Mode pull the rest of that group
// back in too, instead of resuming just the one recipe you clicked into.
async function ensureTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS cook_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      cookbook_id INT NOT NULL,
      recipe_id INT NOT NULL,
      step_index INT NOT NULL DEFAULT 0,
      checked_ingredients TEXT,
      session_id VARCHAR(64),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_recipe (user_id, recipe_id)
    )`)
  } catch {}
  try { await pool.query("ALTER TABLE cook_sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(64)") } catch {}
}

export async function getCookSessions(userId: number, cookbookId: number) {
  await ensureTable()
  // Abandoned sessions (never finished, never revisited) don't need to
  // linger forever — a few days is generous for "I'll get back to this"
  // without leaving stale progress around long enough to be confusing.
  await pool.query("DELETE FROM cook_sessions WHERE updated_at < NOW() - INTERVAL 3 DAY").catch(() => {})
  const [rows]: any = await pool.query(
    "SELECT recipe_id, step_index, checked_ingredients, session_id FROM cook_sessions WHERE user_id = ? AND cookbook_id = ?",
    [userId, cookbookId]
  )
  return rows.map((r: any) => {
    let checked: number[] = []
    try { checked = JSON.parse(r.checked_ingredients || "[]") } catch {}
    return { recipe_id: r.recipe_id, step_index: r.step_index, checked_ingredients: checked, session_id: r.session_id || null }
  })
}

export async function saveCookSession(userId: number, cookbookId: number, recipeId: number, stepIndex: number, checkedIngredients: number[], sessionId: string | null) {
  await ensureTable()
  await pool.query(
    `INSERT INTO cook_sessions (user_id, cookbook_id, recipe_id, step_index, checked_ingredients, session_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE cookbook_id = VALUES(cookbook_id), step_index = VALUES(step_index), checked_ingredients = VALUES(checked_ingredients), session_id = VALUES(session_id), updated_at = CURRENT_TIMESTAMP`,
    [userId, cookbookId, recipeId, stepIndex, JSON.stringify(checkedIngredients), sessionId]
  )
}

export async function clearCookSession(userId: number, recipeId: number) {
  await ensureTable()
  await pool.query("DELETE FROM cook_sessions WHERE user_id = ? AND recipe_id = ?", [userId, recipeId])
}
