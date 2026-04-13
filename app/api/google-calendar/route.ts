import { NextResponse } from "next/server"
import { auth } from "@/auth"
import pool from "@/lib/db"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = (session as any).access_token
  if (!accessToken) {
    return NextResponse.json({ error: "No Google access token. Please sign out and sign back in." }, { status: 401 })
  }

  const { meals } = await req.json()
  const unsyncedMeals = meals.filter((m: any) => !m.synced_to_calendar)

  if (unsyncedMeals.length === 0) {
    return NextResponse.json({ success: true, count: 0 })
  }

  const results = []
  const errors = []

  for (const meal of unsyncedMeals) {
    const startDate = meal.meal_date.split("T")[0]
    const event = {
      summary: `${meal.meal_type}: ${meal.recipe_title}`,
      description: meal.recipe_description || "",
      start: { date: startDate, timeZone: "America/Chicago" },
      end: { date: startDate, timeZone: "America/Chicago" },
      colorId: "6",
    }

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    })

    if (res.ok) {
      const created = await res.json()
      results.push(created)
      await pool.query(
        "UPDATE meal_plans SET synced_to_calendar = 1, gcal_event_id = ? WHERE id = ?",
        [created.id, meal.id]
      )
    } else {
      errors.push(await res.json())
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: "Some events failed to sync", errors })
  }

  return NextResponse.json({ success: true, count: results.length })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = (session as any).access_token
  if (!accessToken) {
    return NextResponse.json({ error: "No Google access token. Please sign out and sign back in." }, { status: 401 })
  }

  const [currentUser] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [session.user.email]
  ) as any[]

  const { start, end } = await req.json()

  const [syncedMeals] = await pool.query(
    `SELECT id, gcal_event_id FROM meal_plans 
     WHERE user_id = ? AND meal_date BETWEEN ? AND ? 
     AND synced_to_calendar = 1 AND gcal_event_id IS NOT NULL`,
    [currentUser[0].id, start, end]
  ) as any[]

  for (const meal of syncedMeals) {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${meal.gcal_event_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  await pool.query(
    `UPDATE meal_plans SET synced_to_calendar = 0, gcal_event_id = NULL
     WHERE user_id = ? AND meal_date BETWEEN ? AND ?`,
    [currentUser[0].id, start, end]
  )

  return NextResponse.json({ success: true, deleted: syncedMeals.length })
}