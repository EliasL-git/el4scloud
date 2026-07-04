'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { webhooks, webhookDeliveries } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { generateWebhookSecret, validateWebhookUrl, parseEvents } from '@/lib/webhooks/validation'
import { fireWebhook } from '@/lib/webhooks/fire'
import { deliver } from '@/lib/webhooks/delivery'
import { assertNotSuspended } from '@/lib/suspension'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  await assertNotSuspended(session.user.id)
  return session.user.id
}

export async function getMyWebhooks() {
  const userId = await getUserId()

  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      active: webhooks.active,
      createdAt: webhooks.createdAt,
      secretPrefix: sql`LEFT(${webhooks.secret}, 8)`,
    })
    .from(webhooks)
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhooks.createdAt))

  return rows.map((row) => ({
    ...row,
    secretPrefix: String(row.secretPrefix ?? '').slice(0, 8),
  }))
}

export async function createMyWebhook(url: string, events: string[]) {
  const userId = await getUserId()

  try {
    validateWebhookUrl(url)
  } catch (err: any) {
    throw new Error(err.message)
  }

  const parsed = parseEvents(events)
  if (parsed.length === 0) {
    throw new Error('No valid events selected')
  }

  const secret = generateWebhookSecret()

  const id = uuidv4()
  await db.insert(webhooks).values({
    id,
    userId,
    url: url.trim(),
    secret,
    events: JSON.stringify(parsed),
    active: true,
  })

  const webhook = await db.select().from(webhooks).where(eq(webhooks.id, id)).then((r) => r[0])
  if (webhook) {
    await fireWebhook(userId, 'webhook.test', { webhookId: id }).catch(() => undefined)
  }

  return {
    id,
    url: webhook.url,
    events: parsed,
    active: webhook.active,
    createdAt: webhook.createdAt,
    secretPrefix: secret.slice(0, 8),
  }
}

export async function deleteMyWebhook(webhookId: string) {
  const userId = await getUserId()

  const [existing] = await db.select().from(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
  if (!existing) throw new Error('Webhook not found')

  await db.delete(webhooks).where(eq(webhooks.id, webhookId))

  return { ok: true }
}

export async function getMyWebhookDeliveries(limit = 50) {
  const userId = await getUserId()

  const userHooks = await db.select({ id: webhooks.id }).from(webhooks).where(eq(webhooks.userId, userId))
  const hookIds = userHooks.map((h) => h.id)

  if (hookIds.length === 0) {
    return []
  }

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, hookIds[0]))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)

  return deliveries
}

export async function testMyWebhook(webhookId: string) {
  const userId = await getUserId()

  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))

  if (!webhook) throw new Error('Webhook not found')

  await deliver(webhook, 'webhook.test', { webhookId })

  return { ok: true }
}
