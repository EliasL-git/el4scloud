import pg from 'pg'
import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'

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

const statements = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id"            TEXT PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "email"         TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "image"         TEXT,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "session" (
    "id"                   TEXT PRIMARY KEY,
    "expiresAt"            TIMESTAMPTZ NOT NULL,
    "token"                TEXT NOT NULL UNIQUE,
    "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "ipAddress"            TEXT,
    "userAgent"            TEXT,
    "userId"               TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "account" (
    "id"                    TEXT PRIMARY KEY,
    "accountId"             TEXT NOT NULL,
    "providerId"            TEXT NOT NULL,
    "userId"                TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken"           TEXT,
    "refreshToken"          TEXT,
    "idToken"               TEXT,
    "accessTokenExpiresAt"  TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    "scope"                 TEXT,
    "password"              TEXT,
    "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "verification" (
    "id"         TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "expiresAt"  TIMESTAMPTZ NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "files" (
    "id"            TEXT PRIMARY KEY,
    "userId"        TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "originalName"  TEXT NOT NULL,
    "key"           TEXT NOT NULL UNIQUE,
    "size"          BIGINT NOT NULL,
    "mimeType"      TEXT NOT NULL,
    "publicUrl"     TEXT,
    "isPublic"      BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS "files_userId_idx" ON "files"("userId")`,

  `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "originalName" TEXT NOT NULL DEFAULT ''`,

  `ALTER TABLE "files" ALTER COLUMN "publicUrl" DROP NOT NULL`,

  `CREATE TABLE IF NOT EXISTS "api_keys" (
    "id"          TEXT PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "keyHash"     TEXT NOT NULL UNIQUE,
    "keyPrefix"   TEXT NOT NULL,
    "lastUsedAt"  TIMESTAMPTZ,
    "expiresAt"   TIMESTAMPTZ,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS "api_keys_userId_idx" ON "api_keys"("userId")`,

  `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ`,

  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user'`,

  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "storageLimit" BIGINT NOT NULL DEFAULT 16106127360`,

  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT FALSE`,

  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "agreedToTerms" BOOLEAN NOT NULL DEFAULT FALSE`,

  `CREATE TABLE IF NOT EXISTS "storage_requests" (
    "id"         TEXT PRIMARY KEY,
    "userId"     TEXT NOT NULL,
    "amount"     TEXT NOT NULL,
    "reason"     TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "adminNote"  TEXT,
    "approvedAmount" TEXT,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `ALTER TABLE "storage_requests" ADD COLUMN IF NOT EXISTS "approvedAmount" TEXT`,

  `CREATE TABLE IF NOT EXISTS "tickets" (
    "id"        TEXT PRIMARY KEY,
    "userId"    TEXT NOT NULL,
    "subject"   TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "audit_log" (
    "id"          TEXT PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "details"     TEXT,
    "ipAddress"   TEXT,
    "userAgent"   TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "audit_log_userId_idx" ON "audit_log"("userId")`,
  `CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log"("action")`,
  `CREATE INDEX IF NOT EXISTS "audit_log_createdAt_idx" ON "audit_log"("createdAt")`,

  `CREATE TABLE IF NOT EXISTS "deletion_requests" (
    "id"          TEXT PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "reason"      TEXT,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "adminNote"   TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "ticket_replies" (
    "id"        TEXT PRIMARY KEY,
    "ticketId"  TEXT NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
    "userId"    TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "fileHash" TEXT`,
  `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "scanStatus" TEXT DEFAULT 'pending'`,
  `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "scanResult" TEXT`,
  `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "scanDuration" INTEGER`,

  `CREATE TABLE IF NOT EXISTS "flagged_hashes" (
    "id"          TEXT PRIMARY KEY,
    "hash"        TEXT NOT NULL UNIQUE,
    "fileId"      TEXT NOT NULL,
    "flaggedBy"   TEXT NOT NULL,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "appealable" BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspensionType" TEXT`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMPTZ`,
  `UPDATE "user" SET "suspensionType" = 'suspended' WHERE "banned" = TRUE AND "suspensionType" IS NULL`,

  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "warningCount" INTEGER NOT NULL DEFAULT 0`,

  `CREATE TABLE IF NOT EXISTS "appeals" (
    "id"          TEXT PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "reason"      TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "adminNote"   TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "access_codes" (
    "id"          TEXT PRIMARY KEY,
    "code"        TEXT NOT NULL UNIQUE,
    "maxUses"     INTEGER NOT NULL DEFAULT 1,
    "usedCount"   INTEGER NOT NULL DEFAULT 0,
    "createdBy"   TEXT NOT NULL,
    "expiresAt"   TIMESTAMPTZ,
    "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
    "note"        TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "takedown_requests" (
    "id"             TEXT PRIMARY KEY,
    "fileId"         TEXT,
    "fileUrl"        TEXT NOT NULL,
    "reporterName"   TEXT,
    "reporterEmail"  TEXT NOT NULL,
    "reason"         TEXT NOT NULL,
    "details"        TEXT,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "adminNote"      TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // If the table already exists with old schema, add the new columns
  `ALTER TABLE "takedown_requests" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "takedown_requests" ADD COLUMN IF NOT EXISTS "details" TEXT`,
  `ALTER TABLE "takedown_requests" ALTER COLUMN "fileId" DROP NOT NULL`,
  `ALTER TABLE "takedown_requests" ALTER COLUMN "reporterName" DROP NOT NULL`,

  `CREATE TABLE IF NOT EXISTS "warnings" (
    "id"        TEXT PRIMARY KEY,
    "userId"    TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "reason"    TEXT NOT NULL,
    "fileName"  TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "warnings_userId_idx" ON "warnings"("userId")`,

  `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`,

  `ALTER TABLE "storage_requests" ADD COLUMN IF NOT EXISTS "age" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "storage_requests" ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "storage_requests" ADD COLUMN IF NOT EXISTS "lastName" TEXT NOT NULL DEFAULT ''`,

  `CREATE TABLE IF NOT EXISTS "share_links" (
    "id"              TEXT PRIMARY KEY,
    "fileId"          TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "token"           TEXT NOT NULL UNIQUE,
    "expiresAt"       TIMESTAMPTZ,
    "maxDownloads"    INTEGER,
    "downloadCount"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "share_links_token_idx" ON "share_links"("token")`,
  `CREATE INDEX IF NOT EXISTS "share_links_fileId_idx" ON "share_links"("fileId")`,

  `CREATE TABLE IF NOT EXISTS "folders" (
    "id"              TEXT PRIMARY KEY,
    "name"            TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "parentFolderId"  TEXT,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "folders_userId_idx" ON "folders"("userId")`,

  `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "folderId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "files_folderId_idx" ON "files"("folderId")`,

  `ALTER TABLE "share_links" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`,

  `CREATE TABLE IF NOT EXISTS "ai_usage" (
    "id"               TEXT PRIMARY KEY,
    "userId"           TEXT NOT NULL,
    "model"            TEXT NOT NULL,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "cost" REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "credits"`,
  `ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "promptTokens"`,
  `ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "completionTokens"`,
  `ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "totalTokens"`,

  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "introductionText" TEXT`,

  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal'`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'general'`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "slaTarget" TIMESTAMPTZ`,
  `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMPTZ`,
  `ALTER TABLE "ticket_replies" ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE INDEX IF NOT EXISTS "ai_usage_userId_idx" ON "ai_usage"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ai_usage_createdAt_idx" ON "ai_usage"("createdAt")`,
]

async function migrate() {
  const client = await pool.connect()
  let userCountBefore = -1
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM "user"')
    userCountBefore = rows[0].count
  } catch {
    // user table doesn't exist yet — first run
  }

  try {
    for (const sql of statements) {
      await client.query(sql)
      const firstLine = sql.trim().split('\n')[0].slice(0, 80)
      console.log('[migrate] OK:', firstLine)
    }

    // Repair: find users missing an email credential account row and create one
    // This detects users damaged by the HackClub OAuth bug that overwrote email rows
    const orphaned = await client.query(`
      SELECT u.id, u.email,
             EXISTS(SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'hackclub') AS "hasHackclub"
      FROM "user" u
      WHERE NOT EXISTS (
        SELECT 1 FROM account a
        WHERE a."userId" = u.id AND a."providerId" = 'email'
      )
    `)
    if (orphaned.rows.length > 0) {
      console.log(`[migrate] Found ${orphaned.rows.length} user(s) with no email credential account. Repairing...`)
      const bcrypt = (await import('bcryptjs')).default
      for (const u of orphaned.rows) {
        const randomPass = randomBytes(16).toString('hex')
        const hashed = await bcrypt.hash(randomPass, 10)
        await client.query({
          text: `INSERT INTO account (id, "accountId", "providerId", "userId", password) VALUES ($1, $2, 'email', $3, $4)`,
          values: [randomBytes(16).toString('hex'), u.email, u.id, hashed],
        })
        if (u.hasHackclub) {
          console.log(`  → Created email account for ${u.email} (user ${u.id}) — had hackclub row but email row was missing (likely overwritten by OAuth bug) — user must reset password`)
        } else {
          console.log(`  → Created account row for ${u.email} (user ${u.id}) — user must reset password`)
        }
      }
    } else {
      console.log('[migrate] All users have email credential accounts — no repair needed.')
    }

    // Verify user count hasn't dropped (only if table existed before)
    if (userCountBefore >= 0) {
      const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM "user"')
      const userCountAfter = rows[0].count
      if (userCountAfter < userCountBefore) {
        console.error(`\n*** WARNING: User count dropped from ${userCountBefore} to ${userCountAfter}! ***`)
        console.error('*** The migration above should not delete users. Check your DB connection. ***\n')
      } else {
        console.log(`[migrate] User count: ${userCountAfter} (unchanged — safe)`)
      }
    }

    console.log('[migrate] All tables created successfully.')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('[migrate] FAILED:', err.message || err.code || err)
  process.exit(1)
})
