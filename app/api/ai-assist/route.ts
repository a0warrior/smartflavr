import { NextResponse } from "next/server"
import { auth } from "@/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, recipe } = await req.json()

  let prompt = ""

  switch (type) {
    case "description":
      prompt = `Write a short appetizing description (2-3 sentences) for this recipe:
Title: ${recipe.title}
Ingredients: ${recipe.ingredients}
Return only the description text, nothing else.`
      break
    case "ingredients":
      prompt = `Based on this recipe, suggest any missing or complementary ingredients that would improve it:
Title: ${recipe.title}
Current ingredients: ${recipe.ingredients}
Instructions: ${recipe.instructions}
Return only a list of suggested ingredients to add, one per line, nothing else.`
      break
    case "instructions":
      prompt = `Rewrite these recipe instructions to be clearer, more detailed and easier to follow:
Title: ${recipe.title}
Ingredients: ${recipe.ingredients}
Current instructions: ${recipe.instructions}
Return only the improved instructions, one step per line, nothing else.`
      break
    case "notes":
      prompt = `Generate helpful tips, variations and substitutions for this recipe:
Title: ${recipe.title}
Ingredients: ${recipe.ingredients}
Instructions: ${recipe.instructions}
Return only the notes text (2-4 sentences), nothing else.`
      break
    default:
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  })

  const content = response.content[0].type === "text" ? response.content[0].text : ""

  return NextResponse.json({ success: true, content })
}