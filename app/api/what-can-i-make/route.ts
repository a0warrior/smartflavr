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

The pantry may be very short — even just one or two items. That's fine: a single ingredient like "chicken" is still a legitimate starting point for several recipes that mostly need pantry staples on top of it. Don't require a high match ratio — surface recipes built around what they DO have, marked "almost" with what's missing, rather than filtering everything out. Only return an empty array if truly nothing in the recipe list shares any ingredient with the inventory at all.

Return ONLY a JSON array — no explanation, no markdown, nothing before or after it. Include up to 8 recipes, best matches first (recipes needing fewer additional ingredients first):
[
  { "id": 123, "status": "ready", "missing": [] },
  { "id": 456, "status": "almost", "missing": ["soy sauce", "sesame oil"] }
]
"status" is "ready" when they have every ingredient (given the assumed basics), otherwise "almost". "missing" lists only what they lack, as short ingredient names. Respond with the JSON array and nothing else.`

  let content = ""
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    })
    content = response.content[0].type === "text" ? response.content[0].text : ""
  } catch (err) {
    console.error("[what-can-i-make] Anthropic call failed:", err)
    return NextResponse.json({ error: "Could not reach the AI right now. Try again." }, { status: 502 })
  }

  // The model is asked for ONLY a JSON array, but may still wrap it in
  // markdown fences or add a stray sentence — pull out just the array
  // instead of assuming the whole response is clean JSON.
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  let matches: any[] = []
  try {
    matches = JSON.parse(jsonMatch ? jsonMatch[0] : content)
  } catch (err) {
    // Degrade to an empty result rather than a hard error — the UI already
    // shows a friendly "no good matches" state — and log the raw response
    // so an unparseable reply is diagnosable if it keeps happening.
    console.error("[what-can-i-make] Could not parse AI response:", err, content)
    matches = []
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
