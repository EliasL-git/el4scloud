import { db } from '@/lib/db'
import { webhookDeliveries, webhooks } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { deliver } from './delivery'

export async function processRetryQueue(): Promise<{ processed: number }> {
  const now = new Date()

  const due = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, 'failed'),
        sql`${webhookDeliveries.attempt} < 3`,
        sql`${webhookDeliveries.nextRetryAt} IS NOT NULL`,
        sql`${webhookDeliveries.nextRetryAt} <= ${now}`,
      )
    )
    .orderBy(desc(webhookDeliveries.createdAt))

  if (due.length === 0) {
    return { processed: 0 }
  }

  const webhookIds = Array.from(new Set(due.map((d) => d.webhookId)))
  const webhookRows = await db
    .select()
    .from(webhooks)
    .where(sql`${webhooks.id} IN (${webhookIds.map((id) => `'${id}'`).join(',')})`)

  const webhookMap = new Map(webhookRows.map((w) => [w.id, w]))

  let processed = 0
  for (const delivery of due) {
    const hook = webhookMap.get(delivery.webhookId)
    if (!hook || !hook.active) continue

    try {
      const event = delivery.event
      const data = JSON.parse(delivery.payload).data ?? {}
      await deliver(hook, event, data)
      processed++
    } catch {
      // continue to next delivery
    }
  }

  return { processed }
}
