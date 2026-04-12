import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function POST(req: Request) {
  const { code } = await req.json()

  const [rows]: any = await pool.query(
    "SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL",
    [code.toUpperCase()]
  )

  if (rows.length === 0) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true })
}