'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { tickets, ticketReplies, user } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import crypto from 'crypto'
import { logAuditEventWithHeaders } from '@/lib/audit'

export async function createTicket(subject: string, message: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const id = crypto.randomUUID()
  await db.insert(tickets).values({ id, userId: session.user.id, subject, message })
  await logAuditEventWithHeaders(session.user.id, 'ticket.created', JSON.stringify({ ticketId: id, subject }))
  return id
}

export async function getMyTickets() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  return db
    .select()
    .from(tickets)
    .where(eq(tickets.userId, session.user.id))
    .orderBy(desc(tickets.createdAt))
}

export async function getTicket(ticketId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.userId, session.user.id)))

  if (!ticket) throw new Error('Not found')
  return ticket
}

export async function getTicketReplies(ticketId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

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

export async function replyToTicket(ticketId: string, message: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.userId, session.user.id)))

  if (!ticket) throw new Error('Not found')

  await db.insert(ticketReplies).values({
    id: crypto.randomUUID(),
    ticketId,
    userId: session.user.id,
    message,
  })
  await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))

  await logAuditEventWithHeaders(session.user.id, 'ticket.replied', JSON.stringify({ ticketId }))
}

export async function closeTicket(ticketId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  await db
    .update(tickets)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(and(eq(tickets.id, ticketId), eq(tickets.userId, session.user.id)))

  await logAuditEventWithHeaders(session.user.id, 'ticket.closed', JSON.stringify({ ticketId }))
}
