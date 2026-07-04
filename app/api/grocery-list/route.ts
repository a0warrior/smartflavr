import { NextResponse } from "next/server"
import { auth } from "@/auth"
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

  const { ingredients } = await req.json()
  if (!ingredients || ingredients.length === 0) return NextResponse.json({ success: true, list: {} })

  const prompt = `Take these recipe ingredients and create an organized grocery list a shopper can walk the store with.

Ingredients (may contain duplicates across recipes):
${ingredients.join("\n")}

Rules:
1. MERGE duplicates into a single line and ADD UP the quantities, converting units where sensible (e.g. "2 cloves garlic" + "3 cloves garlic" → "5 cloves"; "1/2 cup butter" + "4 tbsp butter" → "3/4 cup"). Never list the same ingredient twice.
2. Normalize names (e.g. "diced yellow onion" and "onion, chopped" are both "Yellow onion").
3. Drop non-purchasable items like water. Keep salt/pepper/oil only if a recipe needs unusual amounts or types.
4. Group items into store sections, in the order a typical grocery store is laid out: "Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery", "Pantry", "Frozen", "Other".

Return ONLY a JSON object like this, no other text:
{
  "Produce": [
    { "item": "Bananas", "amount": "3 large" },
    { "item": "Yellow onion", "amount": "2 medium" }
  ],
  "Meat & Seafood": [
    { "item": "Ground beef 80/20", "amount": "4 lbs" }
  ]
}
Only include sections that have items.`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  })

  const content = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = content.replace(/```json|```/g, "").trim()
  const list = JSON.parse(clean)

  await incrementAIUsage(session.user.email)
  return NextResponse.json({ success: true, list })
}
