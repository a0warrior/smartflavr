import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function POST(req: Request) {
  const { code, email, name, image } = await req.json()

  const [rows]: any = await pool.query(
    "SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL",
    [code.toUpperCase()]
  )

  if (rows.length === 0) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true })
}

export async function PUT(req: Request) {
  const { code, email, name, image } = await req.json()

  const [rows]: any = await pool.query(
    "SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL",
    [code.toUpperCase()]
  )

  if (rows.length === 0) {
    return NextResponse.json({ success: false })
  }

  let [users]: any = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  )

  if (users.length === 0) {
    await pool.query(
      "INSERT INTO users (name, email, image) VALUES (?, ?, ?)",
      [name, email, image]
    )
    ;[users] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    )
  }

  await pool.query(
    "UPDATE invite_codes SET used_by = ? WHERE code = ?",
    [users[0].id, code.toUpperCase()]
  )

  return NextResponse.json({ success: true })
}