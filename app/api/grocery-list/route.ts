import { NextResponse } from "next/server"
import { auth } from "@/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { ingredients } = await req.json()

  if (!ingredients || ingredients.length === 0) {
    return NextResponse.json({ success: true, list: {} })
  }

  const prompt = `Take these recipe ingredients and create an organized grocery list.
Combine duplicates, add up quantities where possible, and group by category.

Ingredients:
${ingredients.join("\n")}

Return ONLY a JSON object like this, no other text:
{
  "Produce": [
    { "item": "Bananas", "amount": "3 large" },
    { "item": "Yellow onion", "amount": "2 medium" }
  ],
  "Meat & protein": [
    { "item": "Ground beef 80/20", "amount": "4 lbs" }
  ],
  "Dairy": [],
  "Pantry": [],
  "Frozen": [],
  "Other": []
}
Only include categories that have items. Combine similar ingredients.`

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  })

  const content = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = content.replace(/```json|```/g, "").trim()
  const list = JSON.parse(clean)

  return NextResponse.json({ success: true, list })
}