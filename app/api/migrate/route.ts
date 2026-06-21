import { pool } from '@/lib/db'
import { NextResponse } from 'next/server'

// One-shot migration endpoint — call once to set up all tables.
// Protected by a simple secret so it can't be accidentally run in production by strangers.
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.MIGRATE_SECRET ?? 'nimbus-migrate'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
      "id"         TEXT PRIMARY KEY,
      "expiresAt"  TIMESTAMPTZ NOT NULL,
      "token"      TEXT NOT NULL UNIQUE,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ipAddress"  TEXT,
      "userAgent"  TEXT,
      "userId"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
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
      "id"           TEXT PRIMARY KEY,
      "userId"       TEXT NOT NULL,
      "name"         TEXT NOT NULL,
      "originalName" TEXT NOT NULL,
      "key"          TEXT NOT NULL UNIQUE,
      "size"         BIGINT NOT NULL DEFAULT 0,
      "mimeType"     TEXT NOT NULL DEFAULT 'application/octet-stream',
      "publicUrl"    TEXT,
      "isPublic"     BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS "files_userId_idx" ON "files"("userId")`,
    `CREATE TABLE IF NOT EXISTS "api_keys" (
      "id"         TEXT PRIMARY KEY,
      "userId"     TEXT NOT NULL,
      "name"       TEXT NOT NULL,
      "keyHash"    TEXT NOT NULL UNIQUE,
      "keyPrefix"  TEXT NOT NULL,
      "lastUsedAt" TIMESTAMPTZ,
      "expiresAt"  TIMESTAMPTZ,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS "api_keys_userId_idx" ON "api_keys"("userId")`,
  ]

  const client = await pool.connect()
  const results: string[] = []
  try {
    for (const sql of statements) {
      await client.query(sql)
      results.push(sql.trim().split('\n')[0].slice(0, 80))
    }
    return NextResponse.json({ ok: true, ran: results.length, statements: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    client.release()
  }
}
