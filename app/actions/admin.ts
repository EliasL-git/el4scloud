'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, storageRequests, files, tickets, ticketReplies, appeals, flaggedHashes, deletionRequests, apiKeys, auditLog } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { logAuditEventWithHeaders } from '@/lib/audit'
import { Resend } from 'resend'
import { StorageApprovedEmail } from '@/components/emails/storage-approved'
import { StorageRejectedEmail } from '@/components/emails/storage-rejected'
import { DeletionApprovedEmail } from '@/components/emails/deletion-approved'
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
  if (!query?.trim()) return []
  await logAuditEventWithHeaders(adminId, 'admin.files_searched', JSON.stringify({ query }))
  return db
    .select({
      id: files.id,
      name: files.name,
      originalName: files.originalName,
      size: files.size,
      mimeType: files.mimeType,
      isPublic: files.isPublic,
      createdAt: files.createdAt,
      userId: files.userId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(files)
    .innerJoin(user, eq(files.userId, user.id))
    .where(ilike(files.name, `%${query.trim()}%`))
    .orderBy(desc(files.createdAt))
    .limit(50)
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

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(files)
    .where(eq(files.userId, uid))

  const now = new Date()
  const approvedDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const scheduledDate = firstOfNextMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

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

  if (process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM ?? 'noreply@example.com',
        to: u.email,
        subject: 'Account deletion approved',
        react: DeletionApprovedEmail({
          name: u.name,
          approvedDate,
          fileCount: Number(count),
          scheduledDate,
          adminNote: adminNote ?? undefined,
        }),
      })
    } catch { /* best-effort */ }
  }

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
