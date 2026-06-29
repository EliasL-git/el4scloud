'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, storageRequests, files, tickets, ticketReplies, appeals, flaggedHashes, deletionRequests, apiKeys, auditLog, accessCodes, takedownRequests } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { logAuditEventWithHeaders } from '@/lib/audit'
import { recordWarning } from '@/lib/warnings'
import { s3, S3_BUCKET } from '@/lib/s3'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Resend } from 'resend'
import { StorageApprovedEmail } from '@/components/emails/storage-approved'
import { StorageRejectedEmail } from '@/components/emails/storage-rejected'
import { parseStorageAmount } from '@/lib/storage'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY ?? '')

async function assertAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Forbidden')

  const [u] = await db
    .select({ role: user.role, id: user.id })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (u?.role !== 'admin') throw new Error('Forbidden')
  return u.id
}

export async function getUsers() {
  const adminId = await assertAdmin()
  return db.select().from(user).orderBy(user.createdAt)
}

export async function getRequests() {
  const adminId = await assertAdmin()
  return db
    .select({
      request: storageRequests,
      userName: user.name,
      userEmail: user.email,
    })
    .from(storageRequests)
    .innerJoin(user, eq(storageRequests.userId, user.id))
    .orderBy(storageRequests.createdAt)
}

export async function approveRequest(requestId: string, approvedAmount: string, adminNote?: string) {
  const adminId = await assertAdmin()

  const [req] = await db
    .select()
    .from(storageRequests)
    .where(eq(storageRequests.id, requestId))

  if (!req) throw new Error('Request not found')

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, req.userId))

  if (!u) throw new Error('User not found')

  const limitBytes = parseStorageAmount(approvedAmount)

  await db
    .update(storageRequests)
    .set({ status: 'approved', approvedAmount, adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(storageRequests.id, requestId))

  await db
    .update(user)
    .set({ storageLimit: limitBytes })
    .where(eq(user.id, req.userId))

  if (process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'noreply@example.com',
      to: u.email,
      subject: 'Storage upgrade approved',
      react: StorageApprovedEmail({
        name: u.name,
        requestedAmount: req.amount,
        approvedAmount,
        adminNote: adminNote ?? undefined,
      }),
    })
  }

  await logAuditEventWithHeaders(adminId, 'admin.storage_request_approved', JSON.stringify({ requestId, approvedAmount, targetUserId: req.userId }))
  return { ok: true }
}

export async function rejectRequest(requestId: string, adminNote?: string) {
  const adminId = await assertAdmin()

  const [req] = await db
    .select()
    .from(storageRequests)
    .where(eq(storageRequests.id, requestId))

  if (!req) throw new Error('Request not found')

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, req.userId))

  if (!u) throw new Error('User not found')

  await db
    .update(storageRequests)
    .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(storageRequests.id, requestId))

  if (process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'noreply@example.com',
      to: u.email,
      subject: 'Storage upgrade request',
      react: StorageRejectedEmail({
        name: u.name,
        requestedAmount: req.amount,
        adminNote: adminNote ?? undefined,
      }),
    })
  }

  await logAuditEventWithHeaders(adminId, 'admin.storage_request_rejected', JSON.stringify({ requestId, targetUserId: req.userId }))
  return { ok: true }
}

export async function lockUser(userId: string) {
  const adminId = await assertAdmin()
  await db.update(user).set({ banned: true }).where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.user_locked', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function unlockUser(userId: string) {
  const adminId = await assertAdmin()
  await db.update(user).set({ banned: false }).where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.user_unlocked', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function resetStorageLimit(userId: string) {
  const adminId = await assertAdmin()
  await db
    .update(user)
    .set({ storageLimit: 15 * 1024 * 1024 * 1024 })
    .where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.storage_reset', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function setStorageLimit(userId: string, amount: string) {
  const adminId = await assertAdmin()
  const bytes = parseStorageAmount(amount)
  if (bytes <= 0) throw new Error('Invalid amount')
  await db.update(user).set({ storageLimit: bytes }).where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.storage_set', JSON.stringify({ targetUserId: userId, amount }))
  return { ok: true }
}

export async function revokePublicFiles(userId: string) {
  const adminId = await assertAdmin()
  await db
    .update(files)
    .set({ isPublic: false })
    .where(eq(files.userId, userId))
  await logAuditEventWithHeaders(adminId, 'admin.public_files_revoked', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function adminGetTickets() {
  const adminId = await assertAdmin()
  return db
    .select({
      id: tickets.id,
      subject: tickets.subject,
      message: tickets.message,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      userName: user.name,
      userEmail: user.email,
      userId: tickets.userId,
    })
    .from(tickets)
    .innerJoin(user, eq(tickets.userId, user.id))
    .orderBy(desc(tickets.createdAt))
}

export async function adminGetTicketReplies(ticketId: string) {
  const adminId = await assertAdmin()
  return db
    .select({
      id: ticketReplies.id,
      message: ticketReplies.message,
      createdAt: ticketReplies.createdAt,
      userId: ticketReplies.userId,
      userName: user.name,
      userRole: user.role,
    })
    .from(ticketReplies)
    .innerJoin(user, eq(ticketReplies.userId, user.id))
    .where(eq(ticketReplies.ticketId, ticketId))
    .orderBy(ticketReplies.createdAt)
}

export async function adminReplyToTicket(ticketId: string, message: string) {
  const adminId = await assertAdmin()

  await db.insert(ticketReplies).values({
    id: crypto.randomUUID(),
    ticketId,
    userId: (await auth.api.getSession({ headers: await headers() }))!.user!.id,
    message,
  })
  await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))

  await logAuditEventWithHeaders(adminId, 'admin.ticket_replied', JSON.stringify({ ticketId }))
  return { ok: true }
}

export async function adminCloseTicket(ticketId: string) {
  const adminId = await assertAdmin()
  await db
    .update(tickets)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))
  await logAuditEventWithHeaders(adminId, 'admin.ticket_closed', JSON.stringify({ ticketId }))
  return { ok: true }
}

export async function adminReopenTicket(ticketId: string) {
  const adminId = await assertAdmin()
  await db
    .update(tickets)
    .set({ status: 'open', updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))
  await logAuditEventWithHeaders(adminId, 'admin.ticket_reopened', JSON.stringify({ ticketId }))
  return { ok: true }
}

export async function suspendUser(userId: string, reason: string, appealable: boolean, type: 'suspended' | 'terminated' = 'suspended') {
  const adminId = await assertAdmin()
  const now = new Date()
  await recordWarning(userId, type === 'terminated' ? 'termination' : 'suspension', reason)
  await db
    .update(user)
    .set({
      banned: true,
      suspensionReason: reason,
      appealable,
      suspensionType: type,
      terminatedAt: type === 'terminated' ? now : null,
    })
    .where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, `admin.user_${type}`, JSON.stringify({ targetUserId: userId, reason, appealable }))
  return { ok: true }
}

export async function searchFiles(query: string) {
  const adminId = await assertAdmin()
  await logAuditEventWithHeaders(adminId, 'admin.files_searched', JSON.stringify({ query }))
  const conditions = query?.trim() ? ilike(files.name, `%${query.trim()}%`) : undefined
  return db
    .select({
      id: files.id,
      name: files.name,
      originalName: files.originalName,
      size: files.size,
      mimeType: files.mimeType,
      isPublic: files.isPublic,
      scanStatus: files.scanStatus,
      scanResult: files.scanResult,
      createdAt: files.createdAt,
      userId: files.userId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(files)
    .innerJoin(user, eq(files.userId, user.id))
    .where(conditions)
    .orderBy(desc(files.createdAt))
    .limit(50)
}

export async function resetWarnings(userId: string) {
  const adminId = await assertAdmin()
  await db
    .update(user)
    .set({
      warningCount: 0,
      banned: false,
      suspensionReason: null,
      suspensionType: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.warnings_reset', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function flagHash(hash: string) {
  const adminId = await assertAdmin()
  if (!hash?.trim()) throw new Error('Hash is required')
  await db.insert(flaggedHashes).values({
    id: uuidv4(),
    hash: hash.trim().toLowerCase(),
    fileId: 'manual',
    flaggedBy: 'admin',
  }).catch(() => { throw new Error('Hash already exists') })
  await logAuditEventWithHeaders(adminId, 'admin.hash_flagged', JSON.stringify({ hash: hash.trim().toLowerCase() }))
  return { ok: true }
}

export async function getDeletionRequests() {
  const adminId = await assertAdmin()
  return db
    .select({
      request: deletionRequests,
      userName: user.name,
      userEmail: user.email,
    })
    .from(deletionRequests)
    .innerJoin(user, eq(deletionRequests.userId, user.id))
    .orderBy(desc(deletionRequests.createdAt))
}

export async function approveDeletionRequest(requestId: string, adminNote?: string) {
  const adminId = await assertAdmin()

  const [req] = await db
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.id, requestId))
  if (!req) throw new Error('Request not found')

  const uid = req.userId

  const [u] = await db.select().from(user).where(eq(user.id, uid))
  if (!u) throw new Error('User not found')

  const now = new Date()

  await recordWarning(uid, 'termination', 'Account deletion approved')
  await db
    .update(user)
    .set({
      banned: true,
      suspensionReason: 'Account deletion approved',
      suspensionType: 'terminated',
      terminatedAt: now,
      appealable: false,
    })
    .where(eq(user.id, uid))

  await db
    .update(deletionRequests)
    .set({ status: 'approved', adminNote: adminNote ?? null, updatedAt: now })
    .where(eq(deletionRequests.id, requestId))

  await logAuditEventWithHeaders(adminId, 'admin.deletion_approved', JSON.stringify({ requestId, targetUserId: uid }))
  return { ok: true }
}

export async function rejectDeletionRequest(requestId: string, adminNote?: string) {
  const adminId = await assertAdmin()
  await db
    .update(deletionRequests)
    .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(deletionRequests.id, requestId))
  await logAuditEventWithHeaders(adminId, 'admin.deletion_rejected', JSON.stringify({ requestId }))
  return { ok: true }
}

export async function getLastCronRun() {
  const adminId = await assertAdmin()
  const [entry] = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, 'cron.cleanup.completed'))
    .orderBy(desc(auditLog.createdAt))
    .limit(1)
  return entry ?? null
}

export async function getAuditLogs(opts: { userId?: string; action?: string; limit?: number; offset?: number }) {
  const adminId = await assertAdmin()
  const conditions = []
  if (opts.userId) conditions.push(eq(auditLog.userId, opts.userId))
  if (opts.action) conditions.push(eq(auditLog.action, opts.action))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0)
}

export async function getAppeals() {
  const adminId = await assertAdmin()
  return db
    .select({
      appeal: appeals,
      userName: user.name,
      userEmail: user.email,
    })
    .from(appeals)
    .innerJoin(user, eq(appeals.userId, user.id))
    .orderBy(desc(appeals.createdAt))
}

export async function approveAppeal(appealId: string, adminNote?: string) {
  const adminId = await assertAdmin()

  const [a] = await db
    .select()
    .from(appeals)
    .where(eq(appeals.id, appealId))

  if (!a) throw new Error('Appeal not found')

  await db
    .update(appeals)
    .set({ status: 'approved', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(appeals.id, appealId))

  await db
    .update(user)
    .set({ banned: false, suspensionReason: null, suspensionType: null, terminatedAt: null, appealable: true })
    .where(eq(user.id, a.userId))

  await logAuditEventWithHeaders(adminId, 'admin.appeal_approved', JSON.stringify({ appealId, targetUserId: a.userId }))
  return { ok: true }
}

export async function rejectAppeal(appealId: string, adminNote?: string) {
  const adminId = await assertAdmin()

  const [a] = await db
    .select()
    .from(appeals)
    .where(eq(appeals.id, appealId))

  if (!a) throw new Error('Appeal not found')

  await db
    .update(appeals)
    .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(appeals.id, appealId))

  await logAuditEventWithHeaders(adminId, 'admin.appeal_rejected', JSON.stringify({ appealId }))
  return { ok: true }
}

// ─── Access Codes ───────────────────────────────────────────────

export async function getAccessCodes() {
  const adminId = await assertAdmin()
  return db
    .select({
      code: accessCodes,
      creatorName: user.name,
    })
    .from(accessCodes)
    .leftJoin(user, eq(accessCodes.createdBy, user.id))
    .orderBy(desc(accessCodes.createdAt))
}

export async function generateAccessCode(opts: {
  maxUses: number
  expiresAt?: string
  note?: string
}) {
  const adminId = await assertAdmin()

  const code = uuidv4().slice(0, 12).toUpperCase()

  await db.insert(accessCodes).values({
    id: uuidv4(),
    code,
    maxUses: opts.maxUses,
    usedCount: 0,
    createdBy: adminId,
    expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
    isActive: true,
    note: opts.note ?? null,
  })

  await logAuditEventWithHeaders(adminId, 'admin.access_code_generated', JSON.stringify({ code, maxUses: opts.maxUses }))
  return { code }
}

export async function revokeAccessCode(codeId: string) {
  const adminId = await assertAdmin()
  await db
    .update(accessCodes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(accessCodes.id, codeId))
  await logAuditEventWithHeaders(adminId, 'admin.access_code_revoked', JSON.stringify({ codeId }))
  return { ok: true }
}

// ─── Scan Stats ─────────────────────────────────────────────────

export async function getScanStats() {
  const adminId = await assertAdmin()

  const [avgResult] = await db
    .select({
      avgDuration: sql<number>`ROUND(AVG("scanDuration"))`,
      totalScans: sql<number>`COUNT(*)`,
      past24hScans: sql<number>`COUNT(*) FILTER (WHERE "updatedAt" > NOW() - INTERVAL '24 hours')`,
    })
    .from(files)
    .where(and(
      sql`"scanStatus" IS NOT NULL`,
      sql`"scanStatus" != 'pending'`,
      sql`"scanDuration" IS NOT NULL`,
    ))

  return {
    avgDuration: avgResult?.avgDuration ?? null,
    totalScans: avgResult?.totalScans ?? 0,
    past24hScans: avgResult?.past24hScans ?? 0,
  }
}

// ─── User Stats (per-table averages) ───────────────────────────────

export async function getUserStats() {
  const adminId = await assertAdmin()

  const userCountResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM "user"`)

  const queries = [
    sql`SELECT ROUND(AVG(c))::int AS avg FROM (SELECT COUNT(*) AS c FROM "files" GROUP BY "userId") sub`,
    sql`SELECT ROUND(AVG(c))::int AS avg FROM (SELECT COUNT(*) AS c FROM "api_keys" GROUP BY "userId") sub`,
    sql`SELECT ROUND(AVG(c))::int AS avg FROM (SELECT COUNT(*) AS c FROM "tickets" GROUP BY "userId") sub`,
    sql`SELECT ROUND(AVG(c))::int AS avg FROM (SELECT COUNT(*) AS c FROM "storage_requests" GROUP BY "userId") sub`,
    sql`SELECT ROUND(AVG(c))::int AS avg FROM (SELECT COUNT(*) AS c FROM "appeals" GROUP BY "userId") sub`,
    sql`SELECT ROUND(AVG(c))::int AS avg FROM (SELECT COUNT(*) AS c FROM "warnings" GROUP BY "userId") sub`,
  ]

  const results = await Promise.all(queries.map((q) => db.execute(q)))

  return {
    totalUsers: (userCountResult?.rows?.[0] as any)?.count ?? 0,
    avgFilesPerUser: (results[0].rows[0] as any)?.avg ?? 0,
    avgApiKeysPerUser: (results[1].rows[0] as any)?.avg ?? 0,
    avgTicketsPerUser: (results[2].rows[0] as any)?.avg ?? 0,
    avgStorageRequestsPerUser: (results[3].rows[0] as any)?.avg ?? 0,
    avgAppealsPerUser: (results[4].rows[0] as any)?.avg ?? 0,
    avgWarningsPerUser: (results[5].rows[0] as any)?.avg ?? 0,
  }
}

// ─── Takedown Requests ─────────────────────────────────────────

export async function getTakedownRequests() {
  const adminId = await assertAdmin()
  return db
    .select()
    .from(takedownRequests)
    .orderBy(desc(takedownRequests.createdAt))
}

export async function approveTakedown(requestId: string) {
  const adminId = await assertAdmin()

  const [req] = await db
    .select()
    .from(takedownRequests)
    .where(eq(takedownRequests.id, requestId))
  if (!req) throw new Error('Takedown request not found')

  // Try to delete the file from S3 + DB if we know the fileId
  if (req.fileId) {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, req.fileId))
    if (file) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: file.key }))
      } catch { /* file may already be deleted */ }
      await db.delete(files).where(eq(files.id, req.fileId))
      if (file.fileHash) {
        await db.insert(flaggedHashes).values({
          id: uuidv4(),
          hash: file.fileHash,
          fileId: file.id,
          flaggedBy: 'admin',
        }).catch(() => {})
      }
    }
  }

  await db
    .update(takedownRequests)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(takedownRequests.id, requestId))

  await logAuditEventWithHeaders(adminId, 'admin.takedown_approved', JSON.stringify({ requestId }))
  return { ok: true }
}

export async function rejectTakedown(requestId: string, adminNote?: string) {
  const adminId = await assertAdmin()
  await db
    .update(takedownRequests)
    .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(takedownRequests.id, requestId))
  await logAuditEventWithHeaders(adminId, 'admin.takedown_rejected', JSON.stringify({ requestId }))
  return { ok: true }
}
