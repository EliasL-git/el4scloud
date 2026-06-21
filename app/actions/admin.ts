'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, storageRequests, files, tickets, ticketReplies } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
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
