import { NextResponse } from "next/server"
import { auth } from "@/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { image, text, type } = await req.json()

  try {
    let messages: any[] = []

    const systemPrompt = `You are a recipe extraction assistant. Extract recipe information and return it as a JSON object with these exact fields:
{
  "title": "Recipe name",
  "description": "Brief description",
  "ingredients": "ingredient 1\\ningredient 2\\ningredient 3",
  "instructions": "step 1\\nstep 2\\nstep 3",
  "prep_time": "30 minutes",
  "servings": "4 servings",
  "difficulty": "Easy",
  "notes": "any tips or notes"
}
Return ONLY the JSON object, no other text. If multiple recipes are found, return an array of recipe objects.`

    if (type === "image") {
      messages = [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.split(";")[0].split(":")[1],
              data: image.split(",")[1],
            },
          },
          {
            type: "text",
            text: "Extract the recipe from this image. Return as JSON."
          }
        ]
      }]
    } else {
      messages = [{
        role: "user",
        content: `Extract the recipe from this text. Return as JSON.\n\n${text}`
      }]
    }

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    })

    const content = response.content[0].type === "text" ? response.content[0].text : ""
    const clean = content.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)

    const recipes = Array.isArray(parsed) ? parsed : [parsed]

    return NextResponse.json({ success: true, recipes })
  } catch (err) {
    console.error("Extract file error:", err)
    return NextResponse.json({ error: "Could not extract recipe" }, { status: 500 })
  }
}