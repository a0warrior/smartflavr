import mysql from "mysql2/promise"

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 2,
})

// Idempotent schema migrations — ER_DUP_FIELDNAME (1060) is swallowed after first run
;(async () => {
  const cols = [
    "ALTER TABLE users ADD COLUMN post_timeout_until DATETIME NULL",
    "ALTER TABLE posts ADD COLUMN updated_at DATETIME NULL",
    "ALTER TABLE post_comments ADD COLUMN updated_at DATETIME NULL",
  ]
  for (const sql of cols) {
    try { await pool.query(sql) } catch (e: any) { if (e.errno !== 1060) console.error("[migrate]", e.message) }
  }
})()

export default pool