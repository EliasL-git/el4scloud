import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/admin-promote.mjs <email>')
  process.exit(1)
}

async function promote() {
  const result = await pool.query(
    `UPDATE "user" SET role = 'admin' WHERE email = $1 RETURNING id, name, email, role`,
    [email],
  )

  if (result.rows.length === 0) {
    console.error(`User with email "${email}" not found.`)
    process.exit(1)
  }

  const u = result.rows[0]
  console.log(`Promoted ${u.name} (${u.email}) to admin.`)
  await pool.end()
}

promote().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
