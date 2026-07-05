import { NextResponse } from "next/server"
import { auth } from "@/auth"
import pool from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"
import { getPlanStatus, incrementAIUsage } from "@/lib/subscription"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const status = await getPlanStatus(session.user.email)
  if (!status.canUseAI) {
    return NextResponse.json({ error: "limit_reached", plan: status.plan, limit: status.weeklyLimit }, { status: 402 })
  }

  const { recipe_id, title, ingredients, servings } = await req.json()

  // Only the cookbook owner or an editor collaborator may write nutrition to a recipe
  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [session.user.email])
  const userId = users[0]?.id
  const [rows]: any = await pool.query(
    "SELECT c.id as cookbook_id, c.user_id FROM recipes r JOIN cookbooks c ON r.cookbook_id = c.id WHERE r.id = ?",
    [recipe_id]
  )
  if (!rows[0]) return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
  if (rows[0].user_id !== userId) {
    let allowed = false
    try {
      const [collabs]: any = await pool.query(
        "SELECT role FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
        [rows[0].cookbook_id, userId]
      )
      allowed = !!collabs[0] && collabs[0].role !== "viewer"
    } catch {
      const [collabs]: any = await pool.query(
        "SELECT id FROM cookbook_collaborators WHERE cookbook_id = ? AND user_id = ? AND status = 'accepted'",
        [rows[0].cookbook_id, userId]
      )
      allowed = !!collabs[0]
    }
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const prompt = `You are a registered dietitian calculating precise nutrition facts for a recipe.

Recipe: ${title || ""}
Ingredients list:
${ingredients}
Total servings: ${servings || 1}

Instructions:
1. Parse each ingredient line carefully — identify the food item, quantity, and unit (e.g. "2 tbsp olive oil", "1 cup all-purpose flour", "3 large eggs").
2. Look up realistic nutritional values for each ingredient based on USDA data or well-known food composition tables.
3. Sum all ingredients, then divide by the number of servings to get per-serving values.
4. Do NOT use round numbers like 500 or 520 calories. Calculate precisely from the ingredient amounts.
5. Calories must satisfy: calories ≈ (protein × 4) + (carbs × 4) + (fat × 9). Verify this before returning.

Return ONLY a JSON object — no explanation, no markdown:
{
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "sugar": 0,
  "sodium": 0,
  "vitamins": { "vitamin_a": 0, "vitamin_c": 0, "vitamin_d": 0, "vitamin_b12": 0, "vitamin_b6": 0, "folate": 0 },
  "minerals": { "calcium": 0, "iron": 0, "potassium": 0, "magnesium": 0, "zinc": 0, "phosphorus": 0 },
  "daily_values": {
    "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "sugar": 0, "sodium": 0,
    "vitamin_a": 0, "vitamin_c": 0, "vitamin_d": 0, "vitamin_b12": 0, "vitamin_b6": 0, "folate": 0,
    "calcium": 0, "iron": 0, "potassium": 0, "magnesium": 0, "zinc": 0, "phosphorus": 0
  }
}
All values are numbers. Vitamins/minerals in standard units (mg or mcg). Daily values as whole-number percentages (0–100).`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  })

  const content = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = content.replace(/```json|```/g, "").trim()
  const nutrition = JSON.parse(clean)

  await pool.query("UPDATE recipes SET nutrition = ? WHERE id = ?", [JSON.stringify(nutrition), recipe_id])
  await incrementAIUsage(session.user.email)
  return NextResponse.json({ success: true, nutrition })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const recipe_id = searchParams.get("recipe_id")
  const [recipes] = await pool.query("SELECT nutrition FROM recipes WHERE id = ?", [recipe_id]) as any[]
  if (!recipes || recipes.length === 0) return NextResponse.json({ nutrition: null })
  const nutrition = recipes[0].nutrition
  return NextResponse.json({ nutrition: typeof nutrition === "string" ? JSON.parse(nutrition) : nutrition })
}
