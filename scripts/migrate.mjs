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

  // Now safe to drop any ALTER that relied on IF NOT EXISTS (already applied via UPDATE)
]

async function migrate() {
  const client = await pool.connect()
  try {
    for (const sql of statements) {
      await client.query(sql)
      const firstLine = sql.trim().split('\n')[0].slice(0, 80)
      console.log('[migrate] OK:', firstLine)
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
