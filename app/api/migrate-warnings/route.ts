import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * One-shot migration to add warningCount column.
 * Hit this endpoint once to apply the schema change.
 */
export async function GET() {
  try {
    await db.execute(sql`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "warningCount" INTEGER NOT NULL DEFAULT 0
    `)

    return Response.json({
      ok: true,
      message: 'warningCount column added to user table',
    })
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: err.message,
    }, { status: 500 })
  }
}
