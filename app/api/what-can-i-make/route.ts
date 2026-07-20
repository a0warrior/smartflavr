import { NextResponse } from "next/server"
import { auth } from "@/auth"
import pool from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"
import { getPlanStatus, incrementAIUsage } from "@/lib/subscription"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const [recipes]: any = await pool.query(
    `SELECT r.id, r.title, r.ingredients, r.image_url, r.prep_time, r.cookbook_id, c.title as cookbook_title
     FROM recipes r
     JOIN cookbooks c ON r.cookbook_id = c.id
     WHERE c.user_id = ? AND r.ingredients IS NOT NULL AND r.ingredients != ''
     LIMIT 120`,
    [userId]
  )
  if (recipes.length === 0) {
    return NextResponse.json({ error: "no_recipes" }, { status: 400 })
  }

  const pantryList = pantry.map((p: any) => p.quantity ? `${p.name} (${p.quantity})` : p.name).join(", ")
  const recipeList = recipes
    .map((r: any) => `ID ${r.id} — ${r.title}: ${r.ingredients.split("\n").filter(Boolean).join("; ")}`)
    .join("\n")

  const prompt = `You are a practical home-cooking assistant. A user wants to know which of their saved recipes they can cook right now with what's in their kitchen.

KITCHEN INVENTORY:
${pantryList}

Assume the user also has these basics even if unlisted: water, salt, pepper, and basic cooking oil.
${dietaryRestrictions.length > 0 ? `\nThe user's dietary restrictions: ${dietaryRestrictions.join(", ")}. Exclude any recipe that conflicts with these.\n` : ""}
RECIPES (one per line):
${recipeList}

For each recipe, compare its ingredients against the inventory. Be sensible about matching: "chicken breasts" in the pantry covers "2 lbs chicken breast", "tomatoes" covers "diced tomatoes", etc. Then pick the best matches.

Return ONLY a JSON array — no explanation, no markdown. Include up to 8 recipes, best matches first. Only include recipes where the user has at least half the ingredients:
[
  { "id": 123, "status": "ready", "missing": [] },
  { "id": 456, "status": "almost", "missing": ["soy sauce", "sesame oil"] }
]
"status" is "ready" when they have every ingredient (given the assumed basics), otherwise "almost". "missing" lists only what they lack, as short ingredient names.`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  })

  const content = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = content.replace(/```json|```/g, "").trim()
  let matches: any[]
  try {
    matches = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: "Could not analyze recipes. Try again." }, { status: 500 })
  }

  const byId = new Map(recipes.map((r: any) => [r.id, r]))
  const results = matches
    .filter((m: any) => byId.has(m.id))
    .map((m: any) => {
      const r: any = byId.get(m.id)
      return {
        id: r.id,
        title: r.title,
        image_url: r.image_url,
        prep_time: r.prep_time,
        cookbook_id: r.cookbook_id,
        cookbook_title: r.cookbook_title,
        status: m.status === "ready" ? "ready" : "almost",
        missing: Array.isArray(m.missing) ? m.missing : [],
      }
    })

  await incrementAIUsage(session.user.email)
  return NextResponse.json({ results })
}
