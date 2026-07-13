import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { escape, escapeId } from "mysql2"
import nodemailer from "nodemailer"

export const dynamic = "force-dynamic"

// Weekly database backup, triggered by a Hostinger cron job hitting
//   GET /api/backup?key=<BACKUP_SECRET>
// Dumps every table to a restorable .sql file and emails it as an
// attachment. No mysqldump binary needed — the dump is generated from
// SHOW CREATE TABLE + row data, escaped via mysql2's own escaper.

function escapeValue(v: any): string {
  if (v === null || v === undefined) return "NULL"
  // JSON columns come back from mysql2 as objects/arrays
  if (typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v)) {
    return escape(JSON.stringify(v))
  }
  return escape(v)
}

async function buildDump(): Promise<{ sql: string; tableCount: number; rowCount: number }> {
  const [tableRows]: any = await pool.query("SHOW TABLES")
  const tables: string[] = tableRows.map((r: any) => String(Object.values(r)[0]))

  const parts: string[] = [
    `-- SmartFlavr database backup`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Tables: ${tables.length}`,
    ``,
    `SET FOREIGN_KEY_CHECKS=0;`,
    ``,
  ]

  let rowCount = 0
  for (const table of tables) {
    const id = escapeId(table)
    const [createRows]: any = await pool.query(`SHOW CREATE TABLE ${id}`)
    const createSql = createRows[0]?.["Create Table"]
    parts.push(`-- ----------------------------`)
    parts.push(`-- Table: ${table}`)
    parts.push(`-- ----------------------------`)
    parts.push(`DROP TABLE IF EXISTS ${id};`)
    parts.push(`${createSql};`)
    parts.push(``)

    const [rows]: any = await pool.query(`SELECT * FROM ${id}`)
    if (rows.length > 0) {
      const columns = Object.keys(rows[0])
      const columnList = columns.map(c => escapeId(c)).join(", ")
      // Chunked multi-row INSERTs keep the file compact and restores fast
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500)
        const values = chunk
          .map((row: any) => `(${columns.map(c => escapeValue(row[c])).join(", ")})`)
          .join(",\n")
        parts.push(`INSERT INTO ${id} (${columnList}) VALUES\n${values};`)
      }
      rowCount += rows.length
      parts.push(``)
    }
  }

  parts.push(`SET FOREIGN_KEY_CHECKS=1;`)
  parts.push(``)
  return { sql: parts.join("\n"), tableCount: tables.length, rowCount }
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key")
  if (!process.env.BACKUP_SECRET || key !== process.env.BACKUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json(
      { error: "SMTP not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars" },
      { status: 500 }
    )
  }

  try {
    const { sql, tableCount, rowCount } = await buildDump()
    const date = new Date().toISOString().split("T")[0]
    const to = process.env.BACKUP_EMAIL_TO || "smartflavroperations@gmail.com"

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || "465"),
      secure: parseInt(SMTP_PORT || "465") === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })

    await transporter.sendMail({
      from: `"SmartFlavr Backups" <${SMTP_USER}>`,
      to,
      subject: `SmartFlavr database backup — ${date}`,
      text: [
        `Automatic weekly database backup.`,
        ``,
        `Date: ${new Date().toUTCString()}`,
        `Tables: ${tableCount}`,
        `Rows: ${rowCount}`,
        `File size: ${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB`,
        ``,
        `To restore: phpMyAdmin → Import → upload this file.`,
      ].join("\n"),
      attachments: [{ filename: `smartflavr-backup-${date}.sql`, content: sql }],
    })

    return NextResponse.json({ success: true, tables: tableCount, rows: rowCount, sentTo: to })
  } catch (err: any) {
    console.error("[backup]", err)
    return NextResponse.json({ error: err?.message || "Backup failed" }, { status: 500 })
  }
}
