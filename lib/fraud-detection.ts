import { db } from '@/lib/db'
import { fraudFlags, user, files } from '@/lib/db/schema'
import { eq, sql, and, gte } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export const FLAG_THRESHOLD = 50
export const SUSPEND_THRESHOLD = 80

export async function addFraudFlag(
  userId: string,
  signal: string,
  score: number,
  details?: Record<string, unknown>,
) {
  await db.insert(fraudFlags).values({
    id: uuidv4(),
    userId,
    signal,
    score,
    details: details ? JSON.stringify(details) : null,
  })

  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(score), 0)` })
    .from(fraudFlags)
    .where(eq(fraudFlags.userId, userId))
  const totalScore = row?.total ?? 0

  if (totalScore >= SUSPEND_THRESHOLD) {
    await db
      .update(user)
      .set({
        banned: true,
        suspensionReason: `Fraud detection: score ${totalScore} exceeded auto-suspend threshold`,
        suspensionType: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
  }

  return totalScore
}

export async function checkDuplicateIp(ip: string, newUserId: string) {
  // find other users registered from the same IP (via session table)
  const others = await db.execute<{ userId: string; count: number }>(sql`
    SELECT s."userId", COUNT(*)::int
    FROM session s
    WHERE s."ipAddress" = ${ip}
      AND s."userId" != ${newUserId}
    GROUP BY s."userId"
    HAVING COUNT(*) > 0
    LIMIT 3
  `)
  const dupCount = others.rows?.length ?? 0
  if (dupCount >= 2) {
    await addFraudFlag(newUserId, 'duplicate_ip', 30, { ip, duplicateAccounts: dupCount })
  } else if (dupCount >= 1) {
    await addFraudFlag(newUserId, 'duplicate_ip', 15, { ip, duplicateAccounts: dupCount })
  }
}

export async function checkUploadVelocity(userId: string, fileCount: number) {
  const oneMinAgo = new Date(Date.now() - 60_000)
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(files)
    .where(and(
      eq(files.userId, userId),
      gte(files.createdAt, oneMinAgo),
    ))

  const recentUploads = (row?.count ?? 0) + fileCount
  if (recentUploads > 50) {
    await addFraudFlag(userId, 'velocity_spike', 20, { recentUploads, windowMs: 60_000 })
  } else if (recentUploads > 25) {
    await addFraudFlag(userId, 'velocity_spike', 10, { recentUploads, windowMs: 60_000 })
  }
}

export async function checkStorageAbuse(userId: string) {
  const [u] = await db
    .select({ storageLimit: user.storageLimit })
    .from(user)
    .where(eq(user.id, userId))

  if (!u || u.storageLimit <= 0) return

  const [usage] = await db
    .select({ used: sql<number>`COALESCE(SUM(size), 0)` })
    .from(files)
    .where(eq(files.userId, userId))

  const usedBytes = usage?.used ?? 0
  const ratio = usedBytes / u.storageLimit

  if (ratio > 0.8) {
    const [countRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(files)
      .where(and(
        eq(files.userId, userId),
        sql`size < 10240`, // files smaller than 10KB
      ))
    const smallFileRatio = (countRow?.count ?? 0) / Math.max(1, ratio)
    if (smallFileRatio > 10) {
      await addFraudFlag(userId, 'storage_abuse', 25, {
        usageRatio: Math.round(ratio * 100),
        smallFileCount: countRow?.count ?? 0,
        totalFiles: Math.round(ratio),
      })
    }
  }
}


