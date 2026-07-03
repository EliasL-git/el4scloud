import pg from 'pg'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('./.env', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('='))
    .map(([k, ...v]) => [k, v.join('=')])
)

const { Pool } = pg
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const client = await pool.connect()
  let hasIssues = false

  try {
    // ── 1. Fetch all users ──────────────────────────────────────────────
    const { rows: users } = await client.query(
      `SELECT id, name, email, "emailVerified", banned, "suspensionType" FROM "user" ORDER BY email`
    )
    console.log(`\n🔍 Checking ${users.length} user(s)...\n`)

    for (const u of users) {
      const issues = []
      const info = []

      // ── 2. Check account rows ───────────────────────────────────────
      const { rows: accounts } = await client.query(
        `SELECT id, "providerId", password, "accountId" FROM account WHERE "userId" = $1`,
        [u.id]
      )

      const emailAcct = accounts.find(a => a.providerId === 'email')
      const hackclubAcct = accounts.find(a => a.providerId === 'hackclub')

      // No account rows at all
      if (accounts.length === 0) {
        issues.push('❌ NO ACCOUNT ROWS AT ALL — user cannot log in')
      }

      // Missing email credential row
      if (!emailAcct) {
        issues.push('❌ Missing email credential account row — user cannot log in with password')
      } else {
        // Email row exists — check password hash
        if (!emailAcct.password) {
          issues.push('❌ Email credential row exists but password is NULL')
        } else if (!emailAcct.password.startsWith('$2')) {
          issues.push(`❌ Email credential row has invalid password hash (starts with "${emailAcct.password.slice(0, 6)}...")`)
        } else {
          info.push('✅ Email credential row OK (bcrypt hash present)')
        }

        // Check accountId matches email
        if (emailAcct.accountId !== u.email) {
          issues.push(`⚠️  Email credential accountId mismatch: "${emailAcct.accountId}" vs user email "${u.email}"`)
        }
      }

      // HackClub row info
      if (hackclubAcct) {
        // Check for password on hackclub row (sign of old bug residue)
        if (hackclubAcct.password) {
          await client.query(
            `UPDATE account SET password = NULL WHERE id = $1`,
            [hackclubAcct.id]
          )
          info.push('🔧 Cleaned stale password hash from HackClub account row (OAuth bug residue)')
        }
        info.push(`✅ HackClub linked (accountId: ${hackclubAcct.accountId})`)
      }

      // Duplicate provider rows
      const providerCounts = {}
      for (const a of accounts) {
        providerCounts[a.providerId] = (providerCounts[a.providerId] || 0) + 1
      }
      for (const [provider, count] of Object.entries(providerCounts)) {
        if (count > 1) {
          issues.push(`⚠️  Duplicate ${provider} account rows (${count} found)`)
        }
      }

      // ── 3. Check sessions ──────────────────────────────────────────
      const { rows: [sessionInfo] } = await client.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE "expiresAt" > NOW())::int AS active
         FROM session WHERE "userId" = $1`,
        [u.id]
      )

      // ── 4. Account flags ──────────────────────────────────────────
      if (u.banned) info.push(`🚫 Banned (type: ${u.suspensionType || 'unknown'})`)
      if (!u.emailVerified) info.push('📧 Email NOT verified')

      // ── 5. Print results ──────────────────────────────────────────
      if (issues.length > 0) {
        hasIssues = true
        console.log(`━━━ ${u.email} (${u.name}) ━━━ ⛔ BROKEN`)
        console.log(`    User ID: ${u.id}`)
        console.log(`    Accounts: ${accounts.length} row(s) [${accounts.map(a => a.providerId).join(', ') || 'none'}]`)
        console.log(`    Sessions: ${sessionInfo.active} active / ${sessionInfo.total} total`)
        for (const issue of issues) console.log(`    ${issue}`)
        for (const i of info) console.log(`    ${i}`)
        console.log()
      } else {
        console.log(`✅ ${u.email} (${u.name}) — OK`)
        for (const i of info) console.log(`    ${i}`)
        console.log(`    Sessions: ${sessionInfo.active} active / ${sessionInfo.total} total`)
      }
    }

    // ── 6. Summary ────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60))
    if (hasIssues) {
      console.log('⛔ ISSUES FOUND — run `npm run reset` to fix broken passwords')
      console.log('   or re-run `npm run migrate` to auto-repair missing email rows')
    } else {
      console.log('✅ All users healthy — no issues found')
    }
    console.log('═'.repeat(60) + '\n')

  } finally {
    client.release()
    await pool.end()
  }

  process.exit(hasIssues ? 1 : 0)
}

main().catch((err) => {
  console.error('Health check failed:', err.message || err)
  process.exit(1)
})
