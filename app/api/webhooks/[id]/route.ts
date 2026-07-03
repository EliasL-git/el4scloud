import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { webhooks, webhookDeliveries } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { fireWebhook } from '@/lib/webhooks/fire'
import { NextResponse } from 'next/server'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

async function assertOwnership(webhookId: string, userId: string) {
  const [webhook] = await db.select().from(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
  if (!webhook) throw new Error('Not found')
  return webhook
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  const { id } = await params
  const webhook = await assertOwnership(id, userId)

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(20)

  const { secret, ...safe } = webhook
  return NextResponse.json({
    ...safe,
    secretPrefix: secret.slice(0, 8),
    deliveries,
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  const { id } = await params
  await assertOwnership(id, userId)

  await db.delete(webhooks).where(eq(webhooks.id, id))

  return NextResponse.json({ ok: true })
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  const { id } = await params
  const webhook = await assertOwnership(id, userId)

  await fireWebhook(userId, 'webhook.test', { webhookId: id })

  return NextResponse.json({ ok: true, message: 'Test event dispatched' })
}
