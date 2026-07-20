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
      duration_ms BIGINT NOT NULL,
      ends_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cook_timers_user (user_id)
    )`)
  } catch {}
}

async function fireTimer(id: number, userId: number, label: string) {
  scheduled.delete(id)
  try {
    await sendPush(userId, { title: "Timer done!", body: label, url: "/dashboard" })
  } catch {}
  await pool.query("DELETE FROM cook_timers WHERE id = ?", [id]).catch(() => {})
}

function arm(id: number, userId: number, label: string, endsAt: Date) {
  const delay = endsAt.getTime() - Date.now()
  if (delay <= 0) { fireTimer(id, userId, label); return }
  // setTimeout's delay argument is a 32-bit signed int (~24.8 day max) —
  // timers are always short (minutes/hours), so this is generous headroom,
  // not a real constraint here.
  const handle = setTimeout(() => fireTimer(id, userId, label), Math.min(delay, 2_147_483_000))
  scheduled.set(id, handle)
}

export async function createCookTimer(userId: number, label: string, recipeTitle: string | null, durationMs: number) {
  await ensureTable()
  const endsAt = new Date(Date.now() + durationMs)
  const [result]: any = await pool.query(
    "INSERT INTO cook_timers (user_id, label, recipe_title, duration_ms, ends_at) VALUES (?, ?, ?, ?, ?)",
    [userId, label, recipeTitle, durationMs, endsAt]
  )
  arm(result.insertId, userId, label, endsAt)
  return { id: result.insertId, ends_at: endsAt.toISOString() }
}

export async function cancelCookTimer(userId: number, id: number) {
  await ensureTable()
  const handle = scheduled.get(id)
  if (handle) { clearTimeout(handle); scheduled.delete(id) }
  await pool.query("DELETE FROM cook_timers WHERE id = ? AND user_id = ?", [id, userId])
}

export async function getActiveCookTimers(userId: number) {
  await ensureTable()
  const [rows]: any = await pool.query(
    "SELECT id, label, recipe_title, duration_ms, ends_at FROM cook_timers WHERE user_id = ? AND ends_at > NOW()",
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
    const [rows]: any = await pool.query("SELECT id, user_id, label, ends_at FROM cook_timers WHERE ends_at > NOW()")
    for (const row of rows) arm(row.id, row.user_id, row.label, new Date(row.ends_at))
    // Clean up anything that expired while the server was down — no way to
    // know if the user still wants that push, so just drop it silently.
    await pool.query("DELETE FROM cook_timers WHERE ends_at <= NOW()")
  } catch {}
}
