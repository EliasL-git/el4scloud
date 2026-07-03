import { db } from '@/lib/db'
import { webhooks } from '@/lib/db/schema'
import { deliver } from './delivery'
import { eq, and, sql } from 'drizzle-orm'
import { ALLOWED_EVENTS } from './validation'

export async function fireWebhook(userId: string, event: string, data: Record<string, any>): Promise<void> {
  if (!ALLOWED_EVENTS.has(event)) return

  const hooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.userId, userId), eq(webhooks.active, true)))

  const targets = hooks.filter((hook) => {
    try {
      const events = JSON.parse(hook.events) as string[]
      return events.includes(event)
    } catch {
      return false
    }
  })

  if (targets.length === 0) return

  await Promise.allSettled(
    targets.map((hook) => deliver(hook, event, data).catch(() => undefined))
  )
}
