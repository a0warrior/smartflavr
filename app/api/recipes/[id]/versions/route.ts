import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { auth } from "@/auth"

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS recipe_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT NOT NULL,
    data JSON NOT NULL,
    saved_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recipe_versions_recipe (recipe_id)
  )`)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const { id } = await params
  const [versions]: any = await pool.query(
    `SELECT id, saved_by, created_at,
      JSON_UNQUOTE(JSON_EXTRACT(data, '$.title')) as title
     FROM recipe_versions WHERE recipe_id = ? ORDER BY created_at DESC LIMIT 20`,
    [id]
  )
  return NextResponse.json({ versions })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const { id } = await params
  const { version_id } = await req.json()
  const [rows]: any = await pool.query(
    "SELECT data FROM recipe_versions WHERE id = ? AND recipe_id = ?",
    [version_id, id]
  )
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const recipe = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data
  return NextResponse.json({ recipe })
}
