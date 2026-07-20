import { NextResponse } from "next/server"
import { auth } from "@/auth"
import pool from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"
import { getPlanStatus, incrementAIUsage } from "@/lib/subscription"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Distinct from /api/what-can-i-make: that one matches against the user's
// SAVED recipes. This one ignores cookbooks entirely and has the AI invent
// dish ideas from scratch, based only on what's in the kitchen right now.
export async function POST() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const status = await getPlanStatus(session.user.email)
  if (!status.canUseAI) {
    return NextResponse.json({ error: "limit_reached", plan: status.plan, limit: status.weeklyLimit }, { status: 402 })
  }

  try { await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT") } catch {}
  const [users]: any = await pool.query("SELECT id, dietary_restrictions FROM users WHERE email = ?", [session.user.email])
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const userId = users[0].id
  let dietaryRestrictions: string[] = []
  try { dietaryRestrictions = users[0].dietary_restrictions ? JSON.parse(users[0].dietary_restrictions) : [] } catch {}

  const [pantry]: any = await pool.query(
    "SELECT name, quantity FROM inventory_items WHERE user_id = ? AND in_stock = 1",
    [userId]
  )
  if (pantry.length === 0) {
    return NextResponse.json({ error: "no_inventory" }, { status: 400 })
  }

  const pantryList = pantry.map((p: any) => p.quantity ? `${p.name} (${p.quantity})` : p.name).join(", ")

  const prompt = `You are a creative home-cooking assistant. Invent dish ideas a user could cook using ONLY their own judgment and what's in their kitchen — do not reference any recipe database, just come up with real, sensible dishes.

KITCHEN INVENTORY:
${pantryList}

Assume the user also has these basics even if unlisted: water, salt, pepper, and basic cooking oil.
${dietaryRestrictions.length > 0 ? `\nThe user's dietary restrictions: ${dietaryRestrictions.join(", ")}. Every idea must respect these.\n` : ""}
Come up with:
- Up to 3 dishes fully makeable RIGHT NOW with what's on hand (plus the assumed basics)
- Up to 3 more dishes that are close — needing only 1-3 additional ingredients

Return ONLY a JSON array, no explanation, no markdown:
[
  {
    "title": "Dish name",
    "description": "One appetizing sentence",
    "status": "ready",
    "missing": [],
    "ingredients": "each ingredient on its own line, with quantities",
    "instructions": "each numbered step on its own line",
    "prep_time": "approx total time"
  }
]
"status" is "ready" or "almost". "missing" lists only what they'd need to buy, as short ingredient names (empty array when status is "ready").`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  })

  const content = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = content.replace(/```json|```/g, "").trim()
  let ideas: any[]
  try {
    ideas = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: "Could not generate ideas. Try again." }, { status: 500 })
  }

  const results = (Array.isArray(ideas) ? ideas : []).map((idea: any, i: number) => ({
    id: `idea-${i}`,
    title: String(idea.title || "Untitled dish"),
    description: String(idea.description || ""),
    status: idea.status === "ready" ? "ready" : "almost",
    missing: Array.isArray(idea.missing) ? idea.missing.map((m: any) => String(m)) : [],
    ingredients: String(idea.ingredients || ""),
    instructions: String(idea.instructions || ""),
    prep_time: idea.prep_time ? String(idea.prep_time) : "",
  }))

  await incrementAIUsage(session.user.email)
  return NextResponse.json({ results })
}
