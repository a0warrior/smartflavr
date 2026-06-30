import pool from "@/lib/db"

export type Plan = "free" | "pro" | "premium"

export const WEEKLY_LIMITS: Record<Plan, number | null> = {
  free: 5,
  pro: 50,
  premium: null, // unlimited
}

export interface PlanStatus {
  plan: Plan
  isActive: boolean   // false if plan_expires_at is past
  trialUsed: boolean
  aiUsesThisWeek: number
  weeklyLimit: number | null
  canUseAI: boolean
}

export async function getPlanStatus(email: string): Promise<PlanStatus> {
  const [rows]: any = await pool.query(
    "SELECT plan, plan_expires_at, trial_used, ai_uses_week, ai_week_reset_at FROM users WHERE email = ?",
    [email]
  )
  if (!rows.length) throw new Error("User not found")
  const u = rows[0]

  // Reset weekly counter if the reset date is >7 days ago or null
  const now = new Date()
  const resetAt = u.ai_week_reset_at ? new Date(u.ai_week_reset_at) : null
  if (!resetAt || (now.getTime() - resetAt.getTime()) > 7 * 24 * 60 * 60 * 1000) {
    await pool.query(
      "UPDATE users SET ai_uses_week = 0, ai_week_reset_at = NOW() WHERE email = ?",
      [email]
    )
    u.ai_uses_week = 0
  }

  // Determine effective plan — respect expiry for trial/stripe subs
  let plan: Plan = u.plan || "free"
  let isActive = true
  if (plan !== "free" && u.plan_expires_at) {
    if (new Date(u.plan_expires_at) < now) {
      plan = "free"
      isActive = false
      await pool.query("UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE email = ?", [email])
    }
  }

  const weeklyLimit = WEEKLY_LIMITS[plan]
  const canUseAI = weeklyLimit === null || u.ai_uses_week < weeklyLimit

  return {
    plan,
    isActive,
    trialUsed: !!u.trial_used,
    aiUsesThisWeek: u.ai_uses_week,
    weeklyLimit,
    canUseAI,
  }
}

export async function incrementAIUsage(email: string) {
  await pool.query(
    "UPDATE users SET ai_uses_week = ai_uses_week + 1 WHERE email = ?",
    [email]
  )
}
