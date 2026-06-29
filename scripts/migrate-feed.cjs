// One-time migration: add feed-related columns
// Run: node scripts/migrate-feed.cjs
const fs = require("fs")
const mysql = require("mysql2/promise")

const env = {}
fs.readFileSync(".env.local", "utf-8").split("\n").forEach(line => {
  const [k, ...v] = line.split("=")
  if (k && v.length) env[k.trim()] = v.join("=").trim()
})

async function run() {
  const pool = mysql.createPool({
    host: env.DB_HOST, user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME,
  })
  const migrations = [
    "ALTER TABLE users ADD COLUMN post_timeout_until DATETIME NULL",
    "ALTER TABLE posts ADD COLUMN updated_at DATETIME NULL",
    "ALTER TABLE post_comments ADD COLUMN updated_at DATETIME NULL",
  ]
  for (const sql of migrations) {
    try {
      await pool.query(sql)
      console.log("✓", sql)
    } catch (e) {
      if (e.errno === 1060) console.log("⚠ already exists:", sql.split(" ").slice(4, 7).join(" "))
      else console.error("✗", e.message)
    }
  }
  await pool.end()
  console.log("Done.")
}
run()
