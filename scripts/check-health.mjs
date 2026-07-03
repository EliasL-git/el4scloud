import pg from 'pg'
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
      `SELECT id, name, email, "emailVerified", banned, "suspensionType",
              "verifiedViaHackclub", "verifiedManually", "verificationMeta"
       FROM "user" ORDER BY email`
    )
    console.log(`\n🔍 Checking ${users.length} user(s)...\n`)

    for (const u of users) {
      const issues = []
      const info = []
      const repairs = []

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
          info.push('✅ Email credential OK')
        }

        // Check accountId matches email
        if (emailAcct.accountId !== u.email) {
          issues.push(`⚠️  Email credential accountId mismatch: "${emailAcct.accountId}" vs user email "${u.email}"`)
        }
      }

      // ── 3. HackClub verification flag ─────────────────────────────
      if (hackclubAcct) {
        // Clean stale password on hackclub row
        if (hackclubAcct.password) {
          await client.query(`UPDATE account SET password = NULL WHERE id = $1`, [hackclubAcct.id])
          repairs.push('🔧 Cleaned stale password from HackClub row')
        }

        // Set verifiedViaHackclub if not already set
        if (!u.verifiedViaHackclub) {
          const meta = JSON.stringify({
            method: 'hackclub_oauth',
            hackclubId: hackclubAcct.accountId,
            verifiedAt: new Date().toISOString(),
            setBy: 'check:health',
          })
          await client.query(
            `UPDATE "user" SET "verifiedViaHackclub" = TRUE, "verificationMeta" = $1, "updatedAt" = NOW() WHERE id = $2`,
            [meta, u.id]
          )
          repairs.push('🔧 Set verifiedViaHackclub = true')
        }
        info.push(`✅ HackClub verified (${hackclubAcct.accountId})`)
      }

      // ── 4. Duplicate provider rows ────────────────────────────────
      const providerCounts = {}
      for (const a of accounts) {
        providerCounts[a.providerId] = (providerCounts[a.providerId] || 0) + 1
      }
      for (const [provider, count] of Object.entries(providerCounts)) {
        if (count > 1) {
          issues.push(`⚠️  Duplicate ${provider} account rows (${count} found)`)
        }
      }

      // ── 5. Sessions ───────────────────────────────────────────────
      const { rows: [sessionInfo] } = await client.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE "expiresAt" > NOW())::int AS active
         FROM session WHERE "userId" = $1`,
        [u.id]
      )

      // ── 6. Flags ──────────────────────────────────────────────────
      if (u.banned) info.push(`🚫 Banned (${u.suspensionType || 'unknown'})`)
      if (!u.emailVerified) info.push('📧 Email NOT verified')
      if (u.verifiedViaHackclub || hackclubAcct) info.push('🟢 verifiedViaHackclub = true')
      if (u.verifiedManually) info.push('🟢 verifiedManually = true')

      // ── 7. Print results ──────────────────────────────────────────
      if (issues.length > 0) {
        hasIssues = true
        console.log(`━━━ ${u.email} (${u.name}) ━━━ ⛔ BROKEN`)
      } else {
        console.log(`✅ ${u.email} (${u.name}) — OK`)
      }
      console.log(`    User ID: ${u.id}`)
      console.log(`    Accounts: [${accounts.map(a => a.providerId).join(', ') || 'none'}]`)
      console.log(`    Sessions: ${sessionInfo.active} active / ${sessionInfo.total} total`)
      for (const issue of issues) console.log(`    ${issue}`)
      for (const r of repairs) console.log(`    ${r}`)
      for (const i of info) console.log(`    ${i}`)
      if (u.verificationMeta) {
        try {
          const meta = JSON.parse(u.verificationMeta)
          console.log(`    📋 Verification meta: ${JSON.stringify(meta)}`)
        } catch { /* ignore parse errors */ }
      }
      console.log()
    }

    // ── 8. Summary ────────────────────────────────────────────────────
    console.log('═'.repeat(60))
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
