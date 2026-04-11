import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS result")
    return NextResponse.json({ success: true, message: "Database connected!" })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) })
  }
}