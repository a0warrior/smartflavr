import pool from "@/lib/db"

export type Plan = "free" | "pro" | "premium"

export const WEEKLY_LIMITS: Record<Plan, number | null> = {
  free: 5,
  pro: 25,
  premium: null, // unlimited
}

export interface PlanStatus {
  plan: Plan
  isActive: boolean
  trialUsed: boolean
  aiUsesThisWeek: number
  weeklyLimit: number | null
  canUseAI: boolean
}

export async function runMigrations() {
  const cols = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(10) NOT NULL DEFAULT 'free'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at DATETIME NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_uses_week INT NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_week_reset_at DATETIME NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) NULL`,
  ]
  for (const sql of cols) {
    try { await pool.query(sql) } catch {}
  }
}

export async function getPlanStatus(email: string): Promise<PlanStatus> {
  let rows: any[]
  try {
    const [r]: any = await pool.query(
      "SELECT plan, plan_expires_at, trial_used, ai_uses_week, ai_week_reset_at, is_admin FROM users WHERE email = ?",
      [email]
    )
    rows = r
  } catch {
    return { plan: "free", isActive: true, trialUsed: false, aiUsesThisWeek: 0, weeklyLimit: 5, canUseAI: true }
  }

  if (!rows.length) throw new Error("User not found")
  const u = rows[0]

  // Admins always have unlimited AI access
  if (u.is_admin === 1) {
    return { plan: (u.plan || "free") as Plan, isActive: true, trialUsed: !!u.trial_used, aiUsesThisWeek: 0, weeklyLimit: null, canUseAI: true }
  }

  const now = new Date()
  const resetAt = u.ai_week_reset_at ? new Date(u.ai_week_reset_at) : null
  if (!resetAt || (now.getTime() - resetAt.getTime()) > 7 * 24 * 60 * 60 * 1000) {
    try {
      await pool.query("UPDATE users SET ai_uses_week = 0, ai_week_reset_at = NOW() WHERE email = ?", [email])
    } catch {}
    u.ai_uses_week = 0
  }

  let plan: Plan = u.plan || "free"
  let isActive = true
  if (plan !== "free" && u.plan_expires_at) {
    if (new Date(u.plan_expires_at) < now) {
      plan = "free"
      isActive = false
      try { await pool.query("UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE email = ?", [email]) } catch {}
    }
  }

  const weeklyLimit = WEEKLY_LIMITS[plan]
  const canUseAI = weeklyLimit === null || u.ai_uses_week < weeklyLimit

  return { plan, isActive, trialUsed: !!u.trial_used, aiUsesThisWeek: u.ai_uses_week, weeklyLimit, canUseAI }
}

export async function incrementAIUsage(email: string) {
  try {
    await pool.query("UPDATE users SET ai_uses_week = ai_uses_week + 1 WHERE email = ?", [email])
  } catch {}
}
