import webpush from "web-push"
import pool from "@/lib/db"

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT || "mailto:smartflavroperations@gmail.com"

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

async function ensurePushTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      endpoint VARCHAR(500) NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_endpoint (endpoint(255))
    )`)
  } catch {}
}

// How stale last_active_at can be and still count as "currently using the
// app" — a bit more than the client's 25s heartbeat interval so one missed
// beat (tab backgrounded briefly, brief network hiccup) doesn't wrongly
// suppress a push the user should actually get.
const ACTIVE_WINDOW_MS = 45_000

async function isActiveNow(userId: number): Promise<boolean> {
  try {
    const [rows]: any = await pool.query("SELECT last_active_at FROM users WHERE id = ?", [userId])
    const lastActive = rows[0]?.last_active_at
    if (!lastActive) return false
    return Date.now() - new Date(lastActive).getTime() < ACTIVE_WINDOW_MS
  } catch {
    return false
  }
}

// Fire-and-forget push to every device a user has subscribed on. Silently
// no-ops if VAPID isn't configured (e.g. local dev), the user has no
// subscriptions, or they're actively using the app right now (they'd
// already see the update in-app — a push on top of that is just noise).
export async function sendPush(userId: number, payload: { title: string; body: string; url?: string }) {
  if (!publicKey || !privateKey) return
  if (await isActiveNow(userId)) return
  await ensurePushTable()

  const [subs]: any = await pool.query("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", [userId])
  if (subs.length === 0) return

  await Promise.all(subs.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    } catch (err: any) {
      // Subscription expired or was revoked by the browser — clean it up
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await pool.query("DELETE FROM push_subscriptions WHERE id = ?", [sub.id]).catch(() => {})
      }
    }
  }))
}

export { ensurePushTable }
