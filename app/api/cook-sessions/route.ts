import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"
import { getCookSessions, saveCookSession, clearCookSession } from "@/lib/cookSessions"

async function getUserId(email: string) {
  const [users]: any = await pool.query("SELECT id FROM users WHERE email = ?", [email])
  return users[0]?.id || null
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ sessions: [] })

  const cookbookId = parseInt(new URL(req.url).searchParams.get("cookbook_id") || "", 10)
  if (!cookbookId) return NextResponse.json({ sessions: [] })

  const sessions = await getCookSessions(userId, cookbookId)
  return NextResponse.json({ sessions })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { cookbook_id, recipe_id, step_index, checked_ingredients, session_id } = await req.json()
  if (!cookbook_id || !recipe_id) return NextResponse.json({ error: "cookbook_id and recipe_id required" }, { status: 400 })

  await saveCookSession(
    userId,
    Number(cookbook_id),
    Number(recipe_id),
    typeof step_index === "number" ? step_index : 0,
    Array.isArray(checked_ingredients) ? checked_ingredients.slice(0, 200) : [],
    typeof session_id === "string" ? session_id.slice(0, 64) : null
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await getUserId(session.user.email)
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { recipe_id } = await req.json()
  if (!recipe_id) return NextResponse.json({ error: "recipe_id required" }, { status: 400 })

  await clearCookSession(userId, Number(recipe_id))
  return NextResponse.json({ success: true })
}
