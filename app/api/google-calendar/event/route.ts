import { NextResponse } from "next/server"
import { auth } from "@/auth"
import pool from "@/lib/db"

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = (session as any).access_token
  if (!accessToken) {
    return NextResponse.json({ error: "No Google access token." }, { status: 401 })
  }

  const { event_id, meal_id } = await req.json()

  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  await pool.query(
    "UPDATE meal_plans SET synced_to_calendar = 0, gcal_event_id = NULL WHERE id = ?",
    [meal_id]
  )

  return NextResponse.json({ success: true })
}