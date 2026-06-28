'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, files, apiKeys, storageRequests, tickets, ticketReplies, deletionRequests, auditLog, appeals, warnings } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { logAuditEventWithHeaders } from '@/lib/audit'

export async function requestAccountDeletion(reason?: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [existing] = await db
    .select({ id: deletionRequests.id })
    .from(deletionRequests)
    .where(eq(deletionRequests.userId, session.user.id))

  if (existing) throw new Error('Deletion request already submitted')

  await db.insert(deletionRequests).values({
    id: uuidv4(),
    userId: session.user.id,
    reason: reason ?? null,
  })

  await logAuditEventWithHeaders(session.user.id, 'account.deletion_requested', JSON.stringify({ reason: reason ?? '' }))

  return { ok: true }
}

export async function acceptTerms() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  await db
    .update(user)
    .set({ agreedToTerms: true })
    .where(eq(user.id, session.user.id))

  await logAuditEventWithHeaders(session.user.id, 'account.terms_accepted', JSON.stringify({}))

  return { ok: true }
}

export async function exportMyData() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const userId = session.user.id

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))

  const userFiles = await db
    .select({
      name: files.name,
      originalName: files.originalName,
      size: files.size,
      mimeType: files.mimeType,
      isPublic: files.isPublic,
      scanStatus: files.scanStatus,
      scanResult: files.scanResult,
      key: files.key,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(eq(files.userId, userId))
    .orderBy(desc(files.createdAt))

  const userKeys = await db
    .select({
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt))

  const userRequests = await db
    .select({
      amount: storageRequests.amount,
      reason: storageRequests.reason,
      status: storageRequests.status,
      adminNote: storageRequests.adminNote,
      approvedAmount: storageRequests.approvedAmount,
      createdAt: storageRequests.createdAt,
    })
    .from(storageRequests)
    .where(eq(storageRequests.userId, userId))
    .orderBy(desc(storageRequests.createdAt))

  const userTickets = await db
    .select({
      subject: tickets.subject,
      message: tickets.message,
      status: tickets.status,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(eq(tickets.userId, userId))
    .orderBy(desc(tickets.createdAt))

  const userTicketIds = (await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.userId, userId))).map((t) => t.id)

  let userReplies: any[] = []
  if (userTicketIds.length > 0) {
    userReplies = await db
      .select({
        message: ticketReplies.message,
        createdAt: ticketReplies.createdAt,
      })
      .from(ticketReplies)
      .where(eq(ticketReplies.userId, userId))
      .orderBy(desc(ticketReplies.createdAt))
  }

  const userAuditLog = await db
    .select({
      action: auditLog.action,
      details: auditLog.details,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))

  const userAppeals = await db
    .select({
      reason: appeals.reason,
      status: appeals.status,
      adminNote: appeals.adminNote,
      createdAt: appeals.createdAt,
    })
    .from(appeals)
    .where(eq(appeals.userId, userId))
    .orderBy(desc(appeals.createdAt))

  const userWarnings = await db
    .select({
      type: warnings.type,
      reason: warnings.reason,
      fileName: warnings.fileName,
      createdAt: warnings.createdAt,
    })
    .from(warnings)
    .where(eq(warnings.userId, userId))
    .orderBy(desc(warnings.createdAt))

  await logAuditEventWithHeaders(userId, 'account.data_exported', JSON.stringify({}))

  return {
    exportedAt: new Date().toISOString(),
    profile: u,
    files: userFiles,
    apiKeys: userKeys,
    storageRequests: userRequests,
    tickets: userTickets,
    ticketReplies: userReplies,
    auditLog: userAuditLog,
    appeals: userAppeals,
    warnings: userWarnings,
  }
}
