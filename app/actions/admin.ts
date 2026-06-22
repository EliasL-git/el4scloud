'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, storageRequests, files, tickets, ticketReplies, appeals, flaggedHashes, deletionRequests, apiKeys, creditRequests } from '@/lib/db/schema'
import { eq, desc, ilike } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
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
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (u?.role !== 'admin') throw new Error('Forbidden')
}

export async function getUsers() {
  await assertAdmin()
  return db.select().from(user).orderBy(user.createdAt)
}

export async function getRequests() {
  await assertAdmin()
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
  await assertAdmin()

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

  return { ok: true }
}

export async function rejectRequest(requestId: string, adminNote?: string) {
  await assertAdmin()

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

  return { ok: true }
}

export async function lockUser(userId: string) {
  await assertAdmin()
  await db.update(user).set({ banned: true }).where(eq(user.id, userId))
  return { ok: true }
}

export async function unlockUser(userId: string) {
  await assertAdmin()
  await db.update(user).set({ banned: false }).where(eq(user.id, userId))
  return { ok: true }
}

export async function resetStorageLimit(userId: string) {
  await assertAdmin()
  await db
    .update(user)
    .set({ storageLimit: 15 * 1024 * 1024 * 1024 })
    .where(eq(user.id, userId))
  return { ok: true }
}

export async function setStorageLimit(userId: string, amount: string) {
  await assertAdmin()
  const bytes = parseStorageAmount(amount)
  if (bytes <= 0) throw new Error('Invalid amount')
  await db.update(user).set({ storageLimit: bytes }).where(eq(user.id, userId))
  return { ok: true }
}

export async function revokePublicFiles(userId: string) {
  await assertAdmin()
  await db
    .update(files)
    .set({ isPublic: false })
    .where(eq(files.userId, userId))
  return { ok: true }
}

export async function adminGetTickets() {
  await assertAdmin()
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
  await assertAdmin()
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
  await assertAdmin()

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

  return { ok: true }
}

export async function adminCloseTicket(ticketId: string) {
  await assertAdmin()
  await db
    .update(tickets)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))
  return { ok: true }
}

export async function adminReopenTicket(ticketId: string) {
  await assertAdmin()
  await db
    .update(tickets)
    .set({ status: 'open', updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))
  return { ok: true }
}

export async function suspendUser(userId: string, reason: string, appealable: boolean, type: 'suspended' | 'terminated' = 'suspended') {
  await assertAdmin()
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
  return { ok: true }
}

export async function searchFiles(query: string) {
  await assertAdmin()
  if (!query?.trim()) return []
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
  await assertAdmin()
  if (!hash?.trim()) throw new Error('Hash is required')
  await db.insert(flaggedHashes).values({
    id: uuidv4(),
    hash: hash.trim().toLowerCase(),
    fileId: 'manual',
    flaggedBy: 'admin',
  }).catch(() => { throw new Error('Hash already exists') })
  return { ok: true }
}

export async function getDeletionRequests() {
  await assertAdmin()
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
  await assertAdmin()

  const [req] = await db
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.id, requestId))
  if (!req) throw new Error('Request not found')

  const uid = req.userId

  const userFiles = await db
    .select({ key: files.key })
    .from(files)
    .where(eq(files.userId, uid))

  const s3 = process.env.S3_ENDPOINT
    ? new (await import('@aws-sdk/client-s3')).S3Client({
        region: process.env.S3_REGION ?? 'default',
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      })
    : null

  for (const f of userFiles) {
    try {
      if (s3) {
        await s3.send(new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: f.key,
        }))
      }
    } catch { /* best-effort */ }
  }

  await db.delete(files).where(eq(files.userId, uid))
  await db.delete(appeals).where(eq(appeals.userId, uid))
  await db.delete(apiKeys).where(eq(apiKeys.userId, uid))
  await db.delete(creditRequests).where(eq(creditRequests.userId, uid))
  await db.delete(storageRequests).where(eq(storageRequests.userId, uid))
  await db.delete(tickets).where(eq(tickets.userId, uid))
  await db.delete(user).where(eq(user.id, uid))

  await db
    .update(deletionRequests)
    .set({ status: 'approved', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(deletionRequests.id, requestId))

  return { ok: true }
}

export async function rejectDeletionRequest(requestId: string, adminNote?: string) {
  await assertAdmin()
  await db
    .update(deletionRequests)
    .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(deletionRequests.id, requestId))
  return { ok: true }
}

export async function getAppeals() {
  await assertAdmin()
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
  await assertAdmin()

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

  return { ok: true }
}

export async function rejectAppeal(appealId: string, adminNote?: string) {
  await assertAdmin()

  const [a] = await db
    .select()
    .from(appeals)
    .where(eq(appeals.id, appealId))

  if (!a) throw new Error('Appeal not found')

  await db
    .update(appeals)
    .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(appeals.id, appealId))

  return { ok: true }
}
