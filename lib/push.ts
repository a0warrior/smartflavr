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

// Fire-and-forget push to every device a user has subscribed on. Silently
// no-ops if VAPID isn't configured (e.g. local dev) or the user has no
// subscriptions — callers never need to check either condition themselves.
export async function sendPush(userId: number, payload: { title: string; body: string; url?: string }) {
  if (!publicKey || !privateKey) return
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
