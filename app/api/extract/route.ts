import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: Request) {
  const { url } = await req.json()

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `I have a recipe from this URL: ${url}

Based on the URL and your knowledge, generate a complete recipe for what this URL likely contains. Return ONLY a valid JSON object with no extra text:

{
  "title": "the recipe name",
  "description": "a brief appetizing 1-2 sentence description",
  "ingredients": "each ingredient on its own line",
  "instructions": "each numbered step on its own line",
  "prep_time": "total time",
  "servings": "number of servings"
}`
        }
      ]
    })

    const content = message.content[0]
    if (content.type !== "text") {
      throw new Error("Unexpected response type")
    }

    const text = content.text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const recipe = JSON.parse(jsonMatch[0])
    recipe.source_url = url

    return NextResponse.json({ success: true, recipe })
  } catch (error) {
    console.error("Extraction error:", error)
    return NextResponse.json({ success: false, error: String(error) })
  }
}