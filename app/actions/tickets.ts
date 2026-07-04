'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { tickets, ticketReplies, user, ticketAttachments } from '@/lib/db/schema'
import { eq, and, desc, sql, isNull } from 'drizzle-orm'
import crypto from 'crypto'
import { logAuditEventWithHeaders } from '@/lib/audit'
import { sendMail } from '@/lib/mail'
import { fireWebhook } from '@/lib/webhooks/fire'
import { CATEGORY_SUBCATEGORIES } from '@/lib/ticket-categories'

const SLA_HOURS: Record<string, number> = {
  critical: 1,
  urgent: 4,
  high: 8,
  normal: 24,
  low: 48,
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 5,
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
}

async function notifyAdmins(opts: { userName: string; userEmail: string; subject: string; message: string; ticketId: string; priority: string; category: string }) {
  try {
    const admins = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.role, 'admin'))

    if (admins.length === 0) return

    const { renderToString } = await import('react-dom/server')
    const { NewTicketEmail } = await import('@/components/emails/new-ticket')
    const html = renderToString(NewTicketEmail({
      userName: opts.userName,
      userEmail: opts.userEmail,
      subject: `[${opts.priority.toUpperCase()}] ${opts.subject}`,
      message: opts.message,
      ticketId: opts.ticketId,
    }))

    await Promise.all(admins.map((admin) =>
      sendMail({
        to: admin.email,
        subject: `[Support] ${opts.subject}`,
        html,
      }).catch(() => {})
    ))
  } catch (err: any) {
    console.error('[tickets] Failed to notify admins:', err?.message ?? err)
  }
}

export async function createTicket(subject: string, message: string, category = 'general', priority = 'normal', subcategory?: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const validCategories = Object.keys(CATEGORY_SUBCATEGORIES)
  const validPriorities = ['low', 'normal', 'high', 'urgent', 'critical']

  if (!validCategories.includes(category)) category = 'general'
  if (!validPriorities.includes(priority)) priority = 'normal'

  const subs = CATEGORY_SUBCATEGORIES[category]?.subcategories ?? []
  const validSubValues = subs.map((s) => s.value)
  if (!subcategory || !validSubValues.includes(subcategory)) subcategory = 'other'

  const id = crypto.randomUUID()

  await db.insert(tickets).values({
    id,
    userId: session.user.id,
    subject,
    message,
    category,
    subcategory,
    priority,
  })

  await logAuditEventWithHeaders(session.user.id, 'ticket.created', JSON.stringify({
    ticketId: id, subject, category, subcategory, priority,
  }))

  await fireWebhook(session.user.id, 'ticket.created', { ticketId: id, category, priority }).catch(() => undefined)

  notifyAdmins({
    userName: session.user.name ?? session.user.email ?? 'Unknown',
    userEmail: session.user.email ?? '',
    subject,
    message,
    ticketId: id,
    priority,
    category,
  })

  return id
}

export async function getMyTickets() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const result = await db.execute<{
    id: string
    userId: string
    subject: string
    message: string
    status: string
    priority: string
    category: string
    subcategory: string
    assignedTo: string | null
    createdAt: Date
    updatedAt: Date
    slaTarget: Date | null
    firstResponseAt: Date | null
    replyCount: number
  }>(sql`
    SELECT
      id, "userId", subject, message, status, priority, category, subcategory,
      "assignedTo", "createdAt", "updatedAt", "slaTarget", "firstResponseAt",
      (SELECT COUNT(*)::int FROM ticket_replies WHERE "ticketId" = tickets.id AND "isInternal" = false) AS "replyCount"
    FROM tickets
    WHERE "userId" = ${session.user.id}
    ORDER BY "createdAt" DESC
  `)

  return result.rows ?? []
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

  // Users only see non-internal replies
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
    .where(and(
      eq(ticketReplies.ticketId, ticketId),
      eq(ticketReplies.isInternal, false),
    ))
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
    isInternal: false,
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
