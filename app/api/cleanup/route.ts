import { db } from '@/lib/db'
import { user, files, appeals, apiKeys, creditRequests, storageRequests, tickets, auditLog } from '@/lib/db/schema'
import { eq, lt, inArray } from 'drizzle-orm'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

const s3 = process.env.S3_ENDPOINT
  ? new S3Client({
      region: process.env.S3_REGION ?? 'default',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    })
  : null

const DAYS = 30
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)

  const expiredUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(lt(user.terminatedAt, cutoff))

  if (expiredUsers.length === 0) {
    await db.insert(auditLog).values({
      id: uuidv4(),
      userId: 'cron',
      action: 'cron.cleanup.completed',
      details: JSON.stringify({ deleted: 0 }),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: 'cron-job',
    }).catch(() => {})
    return Response.json({ deleted: 0 })
  }

  const userIds = expiredUsers.map((u) => u.id)

  for (const uid of userIds) {
    const userFiles = await db
      .select({ key: files.key })
      .from(files)
      .where(eq(files.userId, uid))

    for (const f of userFiles) {
      try {
        if (s3) {
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: f.key,
          }))
        }
      } catch { /* best-effort */ }
    }
  }

  await db.delete(appeals).where(inArray(appeals.userId, userIds))
  await db.delete(apiKeys).where(inArray(apiKeys.userId, userIds))
  await db.delete(creditRequests).where(inArray(creditRequests.userId, userIds))
  await db.delete(storageRequests).where(inArray(storageRequests.userId, userIds))
  await db.delete(tickets).where(inArray(tickets.userId, userIds))
  await db.delete(files).where(inArray(files.userId, userIds))
  await db.delete(user).where(inArray(user.id, userIds))

  await db.insert(auditLog).values({
    id: uuidv4(),
    userId: 'cron',
    action: 'cron.cleanup.completed',
    details: JSON.stringify({ deleted: userIds.length }),
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: 'cron-job',
  }).catch(() => {})

  return Response.json({ deleted: userIds.length })
}
