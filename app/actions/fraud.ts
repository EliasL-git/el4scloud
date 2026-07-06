'use server'

import { db } from '@/lib/db'
import { fraudFlags, user, files } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { disposableEmailDomains } from '@/lib/disposable-emails'

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

async function insertFlag(userId: string, signal: string, score: number, details: Record<string, unknown>) {
  // skip if same signal already exists for this user
  const [existing] = await db
    .select({ id: fraudFlags.id })
    .from(fraudFlags)
    .where(and(eq(fraudFlags.userId, userId), eq(fraudFlags.signal, signal)))
    .limit(1)
  if (existing) return 0

  await db.insert(fraudFlags).values({
    id: uuidv4(),
    userId,
    signal,
    score,
    details: JSON.stringify(details),
  })
  return score
}

export async function getFraudScoreMap() {
  await assertAdmin()
  const rows = await db.execute<{ userId: string; totalScore: number }>(sql`
    SELECT ff."userId", COALESCE(SUM(ff.score), 0)::int AS "totalScore"
    FROM "fraud_flags" ff
    GROUP BY ff."userId"
  `)
  const map: Record<string, number> = {}
  for (const r of rows.rows ?? []) {
    map[r.userId] = r.totalScore
  }
  return map
}

export async function addManualFraudFlag(userId: string, signal: string, score: number, reason: string) {
  await assertAdmin()

  const [u] = await db.select().from(user).where(eq(user.id, userId))
  if (!u) throw new Error('User not found')

  const flagId = uuidv4()
  await db.insert(fraudFlags).values({
    id: flagId,
    userId,
    signal,
    score,
    details: JSON.stringify({ reason, flaggedBy: 'admin' }),
  })

  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(score), 0)` })
    .from(fraudFlags)
    .where(eq(fraudFlags.userId, userId))
  const totalScore = row?.total ?? 0

  await db
    .update(user)
    .set({
      banned: true,
      suspensionReason: `Fraud: ${reason} (score ${totalScore})`,
      suspensionType: 'suspended',
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))

  try {
    const { renderToString } = await import('react-dom/server')
    const { FraudSuspensionEmail } = await import('@/components/emails/fraud-suspension')
    const html = renderToString(FraudSuspensionEmail({ name: u.name ?? u.email, score: totalScore }))
    const { sendMail: send } = await import('@/lib/mail')
    await send({ to: u.email, subject: 'Account temporarily suspended', html })
  } catch (err: any) {
    console.error(`[fraud] Failed to send suspension email to ${u.email}:`, err?.message ?? err)
  }

  return { totalScore }
}

export async function recalculateFraudScores() {
  await assertAdmin()

  const allUsers = await db
    .select({ id: user.id, name: user.name, email: user.email, banned: user.banned })
    .from(user)

  const results: Record<string, { skipped: number; added: number }> = {}
  for (const u of allUsers) {
    let added = 0
    let skipped = 0

    // 1. disposable email
    const domain = u.email.split('@').pop()?.toLowerCase()
    if (domain && disposableEmailDomains.has(domain)) {
      const f1 = await insertFlag(u.id, 'disposable_email', 40, { domain })
      if (f1) added += 1; else skipped += 1
    }

    // 2. storage abuse
    const [uRow] = await db
      .select({ storageLimit: user.storageLimit })
      .from(user)
      .where(eq(user.id, u.id))
    if (uRow && uRow.storageLimit > 0) {
      const [usage] = await db
        .select({ used: sql<number>`COALESCE(SUM(size), 0)`, count: sql<number>`COUNT(*)::int` })
        .from(files)
        .where(eq(files.userId, u.id))
      const usedBytes = usage?.used ?? 0
      const fileCount = usage?.count ?? 0
      const ratio = uRow.storageLimit > 0 ? usedBytes / uRow.storageLimit : 0
      if (ratio > 0.8 && fileCount > 5) {
        const [smallRow] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(files)
          .where(and(eq(files.userId, u.id), sql`size < 10240`))
        const smallRatio = fileCount > 0 ? (smallRow?.count ?? 0) / fileCount : 0
        if (smallRatio > 0.5) {
          const f2 = await insertFlag(u.id, 'storage_abuse', 25, { usageRatio: Math.round(ratio * 100), smallFileRatio: Math.round(smallRatio * 100), totalFiles: fileCount })
          if (f2) added += 1; else skipped += 1
        }
      }
    }

    // 3. duplicate IP (via session table)
    const ipRows = await db.execute<{ ipAddress: string; otherUsers: number }>(sql`
      SELECT s."ipAddress", COUNT(DISTINCT s."userId")::int AS "otherUsers"
      FROM session s
      WHERE s."ipAddress" IS NOT NULL
        AND s."userId" = ${u.id}
      GROUP BY s."ipAddress"
      HAVING COUNT(DISTINCT s."userId") < 2
    `)
    for (const ipRow of (ipRows.rows ?? [])) {
      const [others] = await db.execute<{ count: number }>(sql`
        SELECT COUNT(DISTINCT "userId")::int AS count
        FROM session
        WHERE "ipAddress" = ${ipRow.ipAddress} AND "userId" != ${u.id}
      `)
      const dupCount = others?.count ?? 0
      if (dupCount >= 2) {
        const f3 = await insertFlag(u.id, 'duplicate_ip', 30, { ip: ipRow.ipAddress, duplicateAccounts: dupCount })
        if (f3) added += 1; else skipped += 1
      } else if (dupCount >= 1) {
        const f3 = await insertFlag(u.id, 'duplicate_ip', 15, { ip: ipRow.ipAddress, duplicateAccounts: dupCount })
        if (f3) added += 1; else skipped += 1
      }
    }

    // 4. suspicious file types (high ratio of exe/zip/scr)
    const [fileCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(files)
      .where(eq(files.userId, u.id))
    const totalFiles = fileCountRow?.count ?? 0
    if (totalFiles > 3) {
      const [suspicious] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(files)
        .where(and(
          eq(files.userId, u.id),
          sql`LOWER("name") ~ '\\.(exe|scr|bat|cmd|vbs|ps1|msi|jar|dll)$'`,
        ))
      const susCount = suspicious?.count ?? 0
      if (susCount > 0 && susCount / totalFiles > 0.3) {
        const f4 = await insertFlag(u.id, 'suspicious_file_types', 20, { suspiciousCount: susCount, totalFiles })
        if (f4) added += 1; else skipped += 1
      }
    }

    results[u.email] = { added, skipped }
  }

  // find users who crossed the threshold and aren't already banned
  const flaggedUsers = await db.execute<{
    userId: string
    name: string
    email: string
    totalScore: number
  }>(sql`
    SELECT
      u.id AS "userId",
      u.name,
      u.email,
      COALESCE(SUM(ff.score), 0)::int AS "totalScore"
    FROM "user" u
    INNER JOIN "fraud_flags" ff ON ff."userId" = u.id
    WHERE u.banned = FALSE
    GROUP BY u.id
    HAVING COALESCE(SUM(ff.score), 0) >= 50
    ORDER BY "totalScore" DESC
  `)

  return {
    results,
    flaggedUsers: flaggedUsers.rows ?? [],
  }
}

export async function suspendFraudUsers(userIds: string[]) {
  await assertAdmin()
  if (userIds.length === 0) return { suspended: 0 }

  const usersToSuspend = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(
      eq(user.banned, false),
      sql`${user.id} = ANY(${sql.raw(`ARRAY[${userIds.map((id) => `'${id}'`).join(',')}]::text[]`)})`,
    ))

  const now = new Date()
  let suspended = 0
  for (const u of usersToSuspend) {
    const [scoreRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(score), 0)` })
      .from(fraudFlags)
      .where(eq(fraudFlags.userId, u.id))
    const totalScore = scoreRow?.total ?? 0

    await db
      .update(user)
      .set({
        banned: true,
        suspensionReason: `Fraud detection: flagged by historical scan (score ${totalScore})`,
        suspensionType: 'suspended',
        updatedAt: now,
      })
      .where(eq(user.id, u.id))

    try {
      const { renderToString } = await import('react-dom/server')
      const { FraudSuspensionEmail } = await import('@/components/emails/fraud-suspension')
      const html = renderToString(FraudSuspensionEmail({ name: u.name ?? u.email, score: totalScore }))
      const { sendMail } = await import('@/lib/mail')
      await sendMail({ to: u.email, subject: 'Account temporarily suspended', html })
    } catch (err: any) {
      console.error(`[fraud] Failed to send suspension email to ${u.email}:`, err?.message ?? err)
    }

    suspended++
  }

  return { suspended }
}
