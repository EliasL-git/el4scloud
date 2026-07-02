'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, account, storageRequests, files, tickets, ticketReplies, ticketAttachments, appeals, flaggedHashes, deletionRequests, apiKeys, auditLog, accessCodes, takedownRequests, session as sessionTable, warnings } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { logAuditEventWithHeaders } from '@/lib/audit'
import { recordWarning } from '@/lib/warnings'
import { s3, S3_BUCKET } from '@/lib/s3'
import { DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { sendMail } from '@/lib/mail'
import { parseStorageAmount, NO_VERIFICATION_LIMIT } from '@/lib/storage'
import crypto from 'crypto'

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

  try {
    const { renderToString } = await import('react-dom/server')
    const { StorageApprovedEmail } = await import('@/components/emails/storage-approved')
    const html = renderToString(StorageApprovedEmail({
      name: u.name,
      requestedAmount: req.amount,
      approvedAmount,
      adminNote: adminNote ?? undefined,
    }))
    await sendMail({ to: u.email, subject: 'Storage upgrade approved', html })
  } catch (err: any) {
    console.error('[admin] Failed to send approval email:', err?.message ?? err)
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

  try {
    const { renderToString } = await import('react-dom/server')
    const { StorageRejectedEmail } = await import('@/components/emails/storage-rejected')
    const html = renderToString(StorageRejectedEmail({
      name: u.name,
      requestedAmount: req.amount,
      adminNote: adminNote ?? undefined,
    }))
    await sendMail({ to: u.email, subject: 'Storage upgrade request', html })
  } catch (err: any) {
    console.error('[admin] Failed to send rejection email:', err?.message ?? err)
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

  const result = await db.execute<{
    id: string
    subject: string
    message: string
    status: string
    priority: string
    category: string
    assignedTo: string | null
    assignedName: string | null
    createdAt: Date
    updatedAt: Date
    slaTarget: Date | null
    firstResponseAt: Date | null
    userName: string
    userEmail: string
    userId: string
    replyCount: number
  }>(sql`
    SELECT
      tickets.id,
      tickets.subject,
      tickets.message,
      tickets.status,
      tickets.priority,
      tickets.category,
      tickets."assignedTo",
      assignee.name AS "assignedName",
      tickets."createdAt",
      tickets."updatedAt",
      tickets."slaTarget",
      tickets."firstResponseAt",
      "user".name AS "userName",
      "user".email AS "userEmail",
      tickets."userId",
      (SELECT COUNT(*)::int FROM ticket_replies WHERE ticket_replies."ticketId" = tickets.id AND ticket_replies."isInternal" = false) AS "replyCount"
    FROM tickets
    INNER JOIN "user" ON "user".id = tickets."userId"
    LEFT JOIN "user" AS assignee ON assignee.id = tickets."assignedTo"
    ORDER BY
      CASE tickets.priority
        WHEN 'critical' THEN 0
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      tickets."createdAt" DESC
  `)

  return result.rows ?? []
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
      isInternal: ticketReplies.isInternal,
    })
    .from(ticketReplies)
    .innerJoin(user, eq(ticketReplies.userId, user.id))
    .where(eq(ticketReplies.ticketId, ticketId))
    .orderBy(ticketReplies.createdAt)
}

export async function adminReplyToTicket(ticketId: string, message: string, isInternal = false) {
  const adminId = await assertAdmin()

  if (!isInternal) {
    const [current] = await db
      .select({ firstResponseAt: tickets.firstResponseAt, status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, ticketId))

    if (current && !current.firstResponseAt) {
      const now = new Date()
      await db
        .update(tickets)
        .set({
          firstResponseAt: now,
          status: current.status === 'open' ? 'in_progress' : current.status,
          updatedAt: now,
        })
        .where(eq(tickets.id, ticketId))
    } else {
      await db
        .update(tickets)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(tickets.id, ticketId))
    }
  } else {
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
  }

  await db.insert(ticketReplies).values({
    id: crypto.randomUUID(),
    ticketId,
    userId: adminId,
    message,
    isInternal,
  })

  await logAuditEventWithHeaders(
    adminId,
    isInternal ? 'admin.ticket_internal_note' : 'admin.ticket_replied',
    JSON.stringify({ ticketId, isInternal }),
  )

  if (!isInternal) {
    try {
      const [ticket] = await db
        .select({ userId: tickets.userId, subject: tickets.subject, priority: tickets.priority })
        .from(tickets)
        .where(eq(tickets.id, ticketId))

      if (ticket) {
        const [owner] = await db
          .select({ name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, ticket.userId))

        if (owner?.email) {
          const { renderToString } = await import('react-dom/server')
          const { TicketReplyEmail } = await import('@/components/emails/ticket-reply')
          const html = renderToString(TicketReplyEmail({
            name: owner.name ?? owner.email,
            subject: ticket.subject,
            message,
            ticketId,
          }))
          await sendMail({ to: owner.email, subject: `Re: ${ticket.subject}`, html })
        }
      }
    } catch (err: any) {
      console.error('[admin] Failed to send ticket reply email:', err?.message ?? err)
    }
  }

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

export async function adminAssignTicket(ticketId: string, assignToUserId: string | null) {
  const adminId = await assertAdmin()

  if (assignToUserId) {
    const [assignee] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, assignToUserId))

    if (assignee?.role !== 'admin') throw new Error('Can only assign to admins')
  }

  await db
    .update(tickets)
    .set({ assignedTo: assignToUserId, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))

  await logAuditEventWithHeaders(adminId, 'admin.ticket_assigned', JSON.stringify({
    ticketId,
    assignedTo: assignToUserId,
  }))

  return { ok: true }
}

export async function adminUpdatePriority(ticketId: string, priority: string) {
  const adminId = await assertAdmin()

  const validPriorities = ['low', 'normal', 'high', 'urgent', 'critical']
  if (!validPriorities.includes(priority)) throw new Error('Invalid priority')

  await db
    .update(tickets)
    .set({ priority, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))

  await logAuditEventWithHeaders(adminId, 'admin.ticket_priority_changed', JSON.stringify({
    ticketId,
    priority,
  }))

  return { ok: true }
}

export async function adminUpdateStatus(ticketId: string, status: string) {
  const adminId = await assertAdmin()

  const validStatuses = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed']
  if (!validStatuses.includes(status)) throw new Error('Invalid status')

  await db
    .update(tickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))

  await logAuditEventWithHeaders(adminId, 'admin.ticket_status_changed', JSON.stringify({
    ticketId,
    status,
  }))

  return { ok: true }
}

export async function adminGetAdmins() {
  const adminId = await assertAdmin()
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.role, 'admin'))
}

export async function adminGetTicketStats() {
  const adminId = await assertAdmin()

  const counts = await db.execute<{
    status: string
    count: number
  }>(sql`
    SELECT status, COUNT(*)::int AS count
    FROM tickets
    GROUP BY status
  `)

  const priorityCounts = await db.execute<{
    priority: string
    count: number
  }>(sql`
    SELECT priority, COUNT(*)::int AS count
    FROM tickets
    WHERE status NOT IN ('resolved', 'closed')
    GROUP BY priority
  `)

  const overdueCount = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM tickets
    WHERE status NOT IN ('resolved', 'closed')
      AND "slaTarget" IS NOT NULL
      AND "slaTarget" < NOW()
  `)

  const unassignedCount = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM tickets
    WHERE status NOT IN ('resolved', 'closed')
      AND "assignedTo" IS NULL
  `)

  const statusMap: Record<string, number> = {}
  for (const row of counts.rows ?? []) {
    statusMap[row.status] = row.count
  }

  const priorityMap: Record<string, number> = {}
  for (const row of priorityCounts.rows ?? []) {
    priorityMap[row.priority] = row.count
  }

  return {
    byStatus: statusMap,
    byPriority: priorityMap,
    overdue: overdueCount.rows?.[0]?.count ?? 0,
    unassigned: unassignedCount.rows?.[0]?.count ?? 0,
    total: Object.values(statusMap).reduce((a, b) => a + b, 0),
  }
}

export async function adminGetTicketAttachments(ticketId: string) {
  const adminId = await assertAdmin()

  const result = await db.execute<{
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    createdAt: Date
    uploadedByName: string
  }>(sql`
    SELECT
      ta.id, ta."fileName", ta."fileSize", ta."mimeType", ta."createdAt",
      "user".name AS "uploadedByName"
    FROM ticket_attachments ta
    INNER JOIN "user" ON "user".id = ta."uploadedBy"
    WHERE ta."ticketId" = ${ticketId}
    ORDER BY ta."createdAt"
  `)

  return result.rows ?? []
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

export async function setUserEmailVerified(userId: string, verified: boolean) {
  const adminId = await assertAdmin()
  await db
    .update(user)
    .set({ emailVerified: verified, updatedAt: new Date() })
    .where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, verified ? 'admin.email_verified' : 'admin.email_unverified', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function resetVerificationStatus(userId: string) {
  const adminId = await assertAdmin()

  await db.delete(storageRequests).where(
    and(eq(storageRequests.userId, userId), eq(storageRequests.status, 'pending'))
  )

  await db.delete(account).where(
    and(eq(account.userId, userId), eq(account.providerId, 'hackclub'))
  )

  await db
    .update(user)
    .set({ storageLimit: NO_VERIFICATION_LIMIT, updatedAt: new Date() })
    .where(eq(user.id, userId))

  await logAuditEventWithHeaders(adminId, 'admin.verification_reset', JSON.stringify({ targetUserId: userId }))
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

export async function getPendingIntroductions() {
  const adminId = await assertAdmin()
  const _ne = process.env.NO_EMAIL?.trim().toLowerCase()
  if (!(_ne === 'true' || _ne === '1' || _ne === 'yes')) return []
  return db
    .select()
    .from(user)
    .where(eq(user.suspensionType, 'pending_intro'))
    .orderBy(user.createdAt)
}

export async function approveIntroduction(userId: string) {
  const adminId = await assertAdmin()
  const [u] = await db
    .select({ introductionText: user.introductionText })
    .from(user)
    .where(eq(user.id, userId))
  if (!u) throw new Error('User not found')
  await db
    .update(user)
    .set({ emailVerified: true, banned: false, suspensionType: null, suspensionReason: null })
    .where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.introduction_approved', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function rejectIntroduction(userId: string) {
  const adminId = await assertAdmin()
  await db
    .update(user)
    .set({ suspensionType: 'suspended', suspensionReason: 'Introduction rejected by admin.' })
    .where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.introduction_rejected', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function resetIntroduction(userId: string) {
  const adminId = await assertAdmin()
  await db
    .update(user)
    .set({ emailVerified: false, banned: false, suspensionType: null, suspensionReason: null, introductionText: null })
    .where(eq(user.id, userId))
  await logAuditEventWithHeaders(adminId, 'admin.introduction_reset', JSON.stringify({ targetUserId: userId }))
  return { ok: true }
}

export async function deleteUser(userId: string) {
  const adminId = await assertAdmin()

  const [u] = await db.select().from(user).where(eq(user.id, userId))
  if (!u) throw new Error('User not found')

  // Delete S3 objects for all files
  const userFiles = await db
    .select({ key: files.key })
    .from(files)
    .where(eq(files.userId, userId))

  if (userFiles.length > 0) {
    const keys = userFiles.map((f) => ({ Key: f.key }))
    await s3.send(new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: { Objects: keys },
    }))
  }

  // Delete all associated records
  await db.delete(files).where(eq(files.userId, userId))
  await db.delete(storageRequests).where(eq(storageRequests.userId, userId))
  await db.delete(tickets).where(eq(tickets.userId, userId))
  await db.delete(appeals).where(eq(appeals.userId, userId))
  await db.delete(deletionRequests).where(eq(deletionRequests.userId, userId))
  await db.delete(apiKeys).where(eq(apiKeys.userId, userId))
  await db.delete(accessCodes).where(eq(accessCodes.createdBy, userId))
  await db.delete(warnings).where(eq(warnings.userId, userId))

  // account + session have cascade, but delete explicitly
  await db.delete(account).where(eq(account.userId, userId))
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId))

  await db.delete(user).where(eq(user.id, userId))

  await logAuditEventWithHeaders(adminId, 'admin.user_deleted', JSON.stringify({ targetUserId: userId, email: u.email }))
  return { ok: true }
}
