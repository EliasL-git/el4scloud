import { db } from '@/lib/db'
import { user, files, appeals, apiKeys, storageRequests, tickets, auditLog, deletionRequests } from '@/lib/db/schema'
import { eq, lt, inArray } from 'drizzle-orm'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { Resend } from 'resend'
import { DeletionCompletedEmail } from '@/components/emails/deletion-completed'

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

const resend = new Resend(process.env.RESEND_API_KEY ?? '')

const DAYS = 30
const CRON_SECRET = process.env.CRON_SECRET

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(d))
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return `${minutes}m ${secs}s`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m ${secs}s`
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)

  const expiredUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
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

  for (const u of expiredUsers) {
    const userFiles = await db
      .select({ key: files.key, size: files.size })
      .from(files)
      .where(eq(files.userId, u.id))

    const [delReq] = await db
      .select()
      .from(deletionRequests)
      .where(eq(deletionRequests.userId, u.id))
      .orderBy(deletionRequests.createdAt)

    const totalBytes = userFiles.reduce((sum, f) => sum + Number(f.size ?? 0), 0)

    const startedAt = new Date()

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

    const finishedAt = new Date()

    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM ?? 'noreply@example.com',
          to: u.email,
          subject: 'Account deletion completed',
          react: DeletionCompletedEmail({
            name: u.name,
            deletionRequestedAt: delReq ? formatDate(delReq.createdAt) : 'N/A',
            approvedAt: delReq && delReq.updatedAt ? formatDate(delReq.updatedAt) : 'N/A',
            startedAt: formatDate(startedAt),
            finishedAt: formatDate(finishedAt),
            totalDeleted: formatBytes(totalBytes),
            timeFromStart: formatDuration(finishedAt.getTime() - startedAt.getTime()),
            timeFromRequest: delReq
              ? formatDuration(finishedAt.getTime() - new Date(delReq.createdAt).getTime())
              : 'N/A',
          }),
        })
      } catch { /* best-effort */ }
    }
  }

  await db.delete(appeals).where(inArray(appeals.userId, userIds))
  await db.delete(apiKeys).where(inArray(apiKeys.userId, userIds))
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
