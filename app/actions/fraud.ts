'use server'

import { db } from '@/lib/db'
import { fraudFlags, user } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

async function assertAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Forbidden')

  const [u] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (u?.role !== 'admin') throw new Error('Forbidden')
}

export async function getAllFraudScores() {
  await assertAdmin()
  const rows = await db.execute<{
    userId: string
    name: string
    email: string
    totalScore: number
    flagCount: number
    lastFlagged: Date
    banned: boolean
  }>(sql`
    SELECT
      u.id AS "userId",
      u.name,
      u.email,
      COALESCE(SUM(ff.score), 0)::int AS "totalScore",
      COUNT(ff.id)::int AS "flagCount",
      MAX(ff."createdAt") AS "lastFlagged",
      u.banned
    FROM "user" u
    LEFT JOIN "fraud_flags" ff ON ff."userId" = u.id
    GROUP BY u.id, u.name, u.email, u.banned
    ORDER BY "totalScore" DESC
  `)
  return rows.rows ?? []
}

export async function getUserFraudFlags(userId: string) {
  await assertAdmin()
  return db
    .select()
    .from(fraudFlags)
    .where(eq(fraudFlags.userId, userId))
    .orderBy(desc(fraudFlags.createdAt))
}

export async function clearFraudFlags(userId: string) {
  await assertAdmin()
  await db.delete(fraudFlags).where(eq(fraudFlags.userId, userId))
  await db
    .update(user)
    .set({
      banned: false,
      suspensionReason: null,
      suspensionType: null,
      updatedAt: new Date(),
    })
    .where(and(eq(user.id, userId), eq(user.banned, true)))
}
