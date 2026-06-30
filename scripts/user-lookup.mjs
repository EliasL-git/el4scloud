import pg from 'pg'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('./.env', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('='))
    .map(([k, ...v]) => [k, v.join('=')])
)

const email = process.argv[2]?.trim()
if (!email) {
  console.error('Usage: node scripts/user-lookup.mjs <email>')
  process.exit(1)
}

const { Pool } = pg
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function lookup() {
  const { rows } = await pool.query(
    `SELECT
        id, name, email, role,
        "storageLimit",
        banned, "suspensionReason", "suspensionType",
        "warningCount", appealable,
        "emailVerified", "agreedToTerms",
        "createdAt", "updatedAt"
      FROM "user"
      WHERE email = $1`,
    [email],
  )

  if (rows.length === 0) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  const u = rows[0]
  console.log(JSON.stringify(u, null, 2))
  await pool.end()
}

lookup().catch((err) => {
  console.error('Failed:', err.message || err)
  process.exit(1)
})
