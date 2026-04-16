import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/auth"

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, description, trackName } = await req.json()

  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are a friendly cooking instructor. Generate a short, engaging cooking lesson for: "${title}" (from "${trackName}"). Description: "${description}".

Return ONLY a JSON object, no markdown:
{
  "intro": "2-3 sentence intro",
  "steps": [{ "title": "step title", "content": "2-3 sentence explanation" }],
  "tip": "one practical pro tip",
  "quiz": [
    { "question": "question", "options": ["A","B","C","D"], "correct": 0 },
    { "question": "question", "options": ["A","B","C","D"], "correct": 2 },
    { "question": "question", "options": ["A","B","C","D"], "correct": 1 }
  ]
}`
    }]
  })

  try {
    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const lesson = JSON.parse(text.replace(/```json|```/g, "").trim())
    return NextResponse.json({ success: true, lesson })
  } catch {
    return NextResponse.json({ error: "Failed to parse lesson content" }, { status: 500 })
  }
}