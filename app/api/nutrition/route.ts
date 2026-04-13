import { NextResponse } from "next/server"
import { auth } from "@/auth"
import pool from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { recipe_id, ingredients, servings } = await req.json()

  const prompt = `Analyze these recipe ingredients and estimate the nutrition facts per serving.
Ingredients: ${ingredients}
Servings: ${servings || 1}

Return ONLY a JSON object with this exact structure, no other text:
{
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "sugar": 0,
  "sodium": 0,
  "vitamins": {
    "vitamin_a": 0,
    "vitamin_c": 0,
    "vitamin_d": 0,
    "vitamin_b12": 0,
    "vitamin_b6": 0,
    "folate": 0
  },
  "minerals": {
    "calcium": 0,
    "iron": 0,
    "potassium": 0,
    "magnesium": 0,
    "zinc": 0,
    "phosphorus": 0
  },
  "daily_values": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0,
    "vitamin_a": 0,
    "vitamin_c": 0,
    "vitamin_d": 0,
    "vitamin_b12": 0,
    "vitamin_b6": 0,
    "folate": 0,
    "calcium": 0,
    "iron": 0,
    "potassium": 0,
    "magnesium": 0,
    "zinc": 0,
    "phosphorus": 0
  }
}
All numeric values should be numbers not strings. Vitamin and mineral amounts in standard units (mg, mcg). Daily values as percentages (0-100).`

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  })

  const content = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = content.replace(/```json|```/g, "").trim()
  const nutrition = JSON.parse(clean)

  await pool.query(
    "UPDATE recipes SET nutrition = ? WHERE id = ?",
    [JSON.stringify(nutrition), recipe_id]
  )

  return NextResponse.json({ success: true, nutrition })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const recipe_id = searchParams.get("recipe_id")

  const [recipes] = await pool.query(
    "SELECT nutrition FROM recipes WHERE id = ?",
    [recipe_id]
  ) as any[]

  if (!recipes || recipes.length === 0) {
    return NextResponse.json({ nutrition: null })
  }

  const nutrition = recipes[0].nutrition
  return NextResponse.json({ nutrition: typeof nutrition === "string" ? JSON.parse(nutrition) : nutrition })
}