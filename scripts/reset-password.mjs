import pg from 'pg'
import bcrypt from 'bcryptjs'
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

  const password = (await ask('New password: ')).trim()
  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const confirm = (await ask('Confirm password: ')).trim()
  if (password !== confirm) {
    console.error('Passwords do not match.')
    process.exit(1)
  }

  rl.close()

  const { Pool } = pg
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()

  try {
    const { rows: users } = await client.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email],
    )

    if (users.length === 0) {
      console.error('User not found:', email)
      process.exit(1)
    }

    const userId = users[0].id
    const hashedPassword = await bcrypt.hash(password, 10)

    const { rowCount } = await client.query(
      `UPDATE "account" SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" IN ('email', 'credential')`,
      [hashedPassword, userId],
    )

    if (rowCount === 0) {
      console.error('No email account record found for this user.')
      process.exit(1)
    }

    console.log('Password reset successfully for:', email)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err)
  process.exit(1)
})
