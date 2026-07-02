import pg from 'pg'
import { readFileSync } from 'fs'
import { createInterface } from 'readline'

const env = Object.fromEntries(
  readFileSync('./.env', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('='))
    .map(([k, ...v]) => [k, v.join('=')])
)

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function main() {
  const email = (await ask('Email: ')).trim()
  if (!email) {
    console.error('Email is required.')
    process.exit(1)
  }

  const { Pool } = pg
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()

  try {
    const { rows: users } = await client.query(
      'SELECT id, email, banned, "suspensionType", "suspensionReason" FROM "user" WHERE email = $1',
      [email],
    )

    if (users.length === 0) {
      console.error('User not found:', email)
      process.exit(1)
    }

    const u = users[0]
    console.log('Current state:', JSON.stringify(u, null, 2))

    const confirm = (await ask('Unban this user? (y/N): ')).trim().toLowerCase()
    if (confirm !== 'y' && confirm !== 'yes') {
      console.log('Aborted.')
      process.exit(0)
    }

    await client.query(
      `UPDATE "user" SET banned = false, "suspensionType" = NULL, "suspensionReason" = NULL WHERE email = $1`,
      [email],
    )

    console.log('Unbanned successfully:', email)
  } finally {
    client.release()
    await pool.end()
    rl.close()
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err)
  process.exit(1)
})
