import pool from "@/lib/db"
import { sendPush } from "@/lib/push"

// Cooking-mode timers are persisted server-side (not just in React state) so
// they keep running — and still notify the user — if they close the tab,
// background the app, or accidentally swipe it away mid-cook. This Node
// process stays alive long-term under Passenger (not serverless), so a
// plain in-memory setTimeout per timer is enough to fire the push at the
// right moment without needing a real job queue.
//
// Caveat: a server restart/redeploy clears these in-memory setTimeouts. To
// survive that, rescheduleAllPending() re-reads any still-pending timers
// from the DB and re-arms them on module load (i.e. on process start).
const scheduled = new Map<number, NodeJS.Timeout>()

async function ensureTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS cook_timers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      label VARCHAR(200) NOT NULL,
      recipe_title VARCHAR(255),
      cookbook_id INT,
      recipe_id INT,
      step_index INT,
      duration_ms BIGINT NOT NULL,
      ends_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cook_timers_user (user_id)
    )`)
  } catch {}
  // Lazily add the resume-navigation columns for tables created before they existed
  try { await pool.query("ALTER TABLE cook_timers ADD COLUMN IF NOT EXISTS cookbook_id INT") } catch {}
  try { await pool.query("ALTER TABLE cook_timers ADD COLUMN IF NOT EXISTS recipe_id INT") } catch {}
  try { await pool.query("ALTER TABLE cook_timers ADD COLUMN IF NOT EXISTS step_index INT") } catch {}
}

function resumeUrl(cookbookId: number | null, recipeId: number | null, stepIndex: number | null) {
  if (!cookbookId || !recipeId) return "/dashboard"
  const step = typeof stepIndex === "number" ? `&resumeStep=${stepIndex}` : ""
  return `/cookbook/${cookbookId}?recipe=${recipeId}&resumeCooking=1${step}`
}

async function fireTimer(id: number, userId: number, label: string, cookbookId: number | null, recipeId: number | null, stepIndex: number | null) {
  scheduled.delete(id)
  try {
    await sendPush(userId, { title: "Timer done!", body: label, url: resumeUrl(cookbookId, recipeId, stepIndex) })
  } catch {}
  // Deliberately not deleted here — the row lingers (see the grace window
  // in getActiveCookTimers) so the global timer indicator and Cooking Mode
  // can still see it and show a "done" state instead of it just vanishing
  // the instant it hits zero.
}

function arm(id: number, userId: number, label: string, endsAt: Date, cookbookId: number | null = null, recipeId: number | null = null, stepIndex: number | null = null) {
  const delay = endsAt.getTime() - Date.now()
  if (delay <= 0) { fireTimer(id, userId, label, cookbookId, recipeId, stepIndex); return }
  // setTimeout's delay argument is a 32-bit signed int (~24.8 day max) —
  // timers are always short (minutes/hours), so this is generous headroom,
  // not a real constraint here.
  const handle = setTimeout(() => fireTimer(id, userId, label, cookbookId, recipeId, stepIndex), Math.min(delay, 2_147_483_000))
  scheduled.set(id, handle)
}

export async function createCookTimer(
  userId: number,
  label: string,
  recipeTitle: string | null,
  durationMs: number,
  cookbookId: number | null = null,
  recipeId: number | null = null,
  stepIndex: number | null = null
) {
  await ensureTable()
  const endsAt = new Date(Date.now() + durationMs)
  const [result]: any = await pool.query(
    "INSERT INTO cook_timers (user_id, label, recipe_title, cookbook_id, recipe_id, step_index, duration_ms, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [userId, label, recipeTitle, cookbookId, recipeId, stepIndex, durationMs, endsAt]
  )
  arm(result.insertId, userId, label, endsAt, cookbookId, recipeId, stepIndex)
  return { id: result.insertId, ends_at: endsAt.toISOString() }
}

export async function cancelCookTimer(userId: number, id: number) {
  await ensureTable()
  const handle = scheduled.get(id)
  if (handle) { clearTimeout(handle); scheduled.delete(id) }
  await pool.query("DELETE FROM cook_timers WHERE id = ? AND user_id = ?", [id, userId])
}

// A finished timer stays visible for a grace window after ends_at (rather
// than disappearing the instant it hits zero) so the UI has a chance to
// show a "done" state and let the user tap back in or dismiss it.
const DONE_GRACE_SQL = "NOW() - INTERVAL 30 MINUTE"

export async function getActiveCookTimers(userId: number) {
  await ensureTable()
  // Opportunistic cleanup of anything that's sat done-and-ignored past the
  // grace window, so rows don't accumulate forever if never dismissed.
  await pool.query(`DELETE FROM cook_timers WHERE ends_at <= ${DONE_GRACE_SQL}`).catch(() => {})
  const [rows]: any = await pool.query(
    `SELECT id, label, recipe_title, cookbook_id, recipe_id, step_index, duration_ms, ends_at FROM cook_timers WHERE user_id = ? AND ends_at > ${DONE_GRACE_SQL}`,
    [userId]
  )
  return rows
}

// Called once at module load (i.e. once per server process start) to
// re-arm any timers that were pending when the process last stopped.
let rehydrated = false
export async function rescheduleAllPending() {
  if (rehydrated) return
  rehydrated = true
  await ensureTable()
  try {
    const [rows]: any = await pool.query("SELECT id, user_id, label, cookbook_id, recipe_id, step_index, ends_at FROM cook_timers WHERE ends_at > NOW()")
    for (const row of rows) arm(row.id, row.user_id, row.label, new Date(row.ends_at), row.cookbook_id, row.recipe_id, row.step_index)
    // Push notifications for anything that finished while the server was
    // down were missed — no way to recover those now. But don't wipe the
    // rows outright: keep the same grace window as getActiveCookTimers so
    // a timer that finished shortly before a deploy still shows as "done"
    // in the UI instead of just disappearing.
    await pool.query(`DELETE FROM cook_timers WHERE ends_at <= ${DONE_GRACE_SQL}`)
  } catch {}
}
