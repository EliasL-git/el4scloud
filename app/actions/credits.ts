'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, creditRequests } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { logAuditEventWithHeaders } from '@/lib/audit'

async function assertAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Forbidden')

  const [u] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (u?.role !== 'admin') throw new Error('Forbidden')
}

export async function requestCredits(amount: number, reason: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  if (amount <= 0) throw new Error('Amount must be positive')
  if (!reason.trim()) throw new Error('Reason is required')

  await db.insert(creditRequests).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    amount,
    reason,
  })

  await logAuditEventWithHeaders(session.user.id, 'credits.requested', JSON.stringify({ amount, reason }))

  return { ok: true }
}

export async function getCreditRequests() {
  await assertAdmin()
  return db
    .select({
      request: creditRequests,
      userName: user.name,
      userEmail: user.email,
    })
    .from(creditRequests)
    .innerJoin(user, eq(creditRequests.userId, user.id))
    .orderBy(desc(creditRequests.createdAt))
}

export async function approveCreditRequest(requestId: string, approvedAmount: number, adminNote?: string) {
  await assertAdmin()

  const session = await auth.api.getSession({ headers: await headers() })
  const adminId = session!.user.id

  const [req] = await db
    .select()
    .from(creditRequests)
    .where(eq(creditRequests.id, requestId))

  if (!req) throw new Error('Request not found')

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, req.userId))

  if (!u) throw new Error('User not found')

  await db
    .update(creditRequests)
    .set({ status: 'approved', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(creditRequests.id, requestId))

  await db
    .update(user)
    .set({ creditsRemaining: sql`${user.creditsRemaining} + ${approvedAmount}` })
    .where(eq(user.id, req.userId))

  await logAuditEventWithHeaders(adminId, 'credits.approved', JSON.stringify({ requestId, approvedAmount }))

  return { ok: true }
}

export async function rejectCreditRequest(requestId: string, adminNote?: string) {
  await assertAdmin()

  const session = await auth.api.getSession({ headers: await headers() })
  const adminId = session!.user.id

  const [req] = await db
    .select()
    .from(creditRequests)
    .where(eq(creditRequests.id, requestId))

  if (!req) throw new Error('Request not found')

  await db
    .update(creditRequests)
    .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(creditRequests.id, requestId))

  await logAuditEventWithHeaders(adminId, 'credits.rejected', JSON.stringify({ requestId, adminNote }))

  return { ok: true }
}

export async function issueCredits(userId: string, amount: number) {
  await assertAdmin()

  const session = await auth.api.getSession({ headers: await headers() })
  const adminId = session!.user.id

  if (amount <= 0) throw new Error('Amount must be positive')

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))

  if (!u) throw new Error('User not found')

  await db
    .update(user)
    .set({ creditsRemaining: sql`${user.creditsRemaining} + ${amount}` })
    .where(eq(user.id, userId))

  await logAuditEventWithHeaders(adminId, 'credits.issued', JSON.stringify({ targetUserId: userId, amount }))

  return { ok: true }
}
