import crypto from 'crypto'
import { db } from '@/lib/db'
import { webhooks, webhookDeliveries } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { signPayload } from './sign'

const REQUEST_TIMEOUT_MS = 10_000

export async function deliver(webhook: typeof webhooks.$inferSelect, event: string, data: Record<string, any>): Promise<void> {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  let deliveryId = crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`
  let signature = ''
  try {
    const sig = signPayload(webhook.secret, payload)
    deliveryId = sig.deliveryId as `${string}-${string}-${string}-${string}-${string}`
    signature = sig.signature
  } catch {
    deliveryId = crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`
  }

  const content = buildContent(event, data)

  let responseCode: number | undefined
  let status: 'success' | 'failed' = 'failed'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature-256': signature,
        'X-Webhook-Delivery-ID': deliveryId,
      },
      body: JSON.stringify({ ...payload, content }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    responseCode = res.status

    if (res.ok) {
      status = 'success'
    }
  } catch {
    status = 'failed'
  }

  const existingAttempt = await db
    .select({ attempt: webhookDeliveries.attempt })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhook.id))
    .orderBy((webhookDeliveries) => [webhookDeliveries.attempt])
    .then((rows) => rows.length)

  const nextAttempt = existingAttempt + 1

  await db.insert(webhookDeliveries).values({
    id: crypto.randomUUID(),
    webhookId: webhook.id,
    event,
    payload: JSON.stringify(payload),
    status,
    responseCode: responseCode ?? null,
    attempt: nextAttempt,
    nextRetryAt: status === 'failed' && nextAttempt < 3 ? computeNextRetry(nextAttempt) : null,
  })
}

function computeNextRetry(attempt: number): Date {
  const backoffs = [5_000, 30_000, 5 * 60_000]
  const ms = backoffs[Math.max(0, Math.min(attempt - 1, backoffs.length - 1))]
  return new Date(Date.now() + ms)
}

function buildContent(event: string, data: Record<string, any>): string {
  switch (event) {
    case 'file.uploaded':
      return `File uploaded: ${data.name ?? data.fileId ?? 'unknown'}`
    case 'file.scanned':
      return `File scan complete: ${data.scanResult ?? 'unknown'} for ${data.fileId ?? 'unknown'}`
    case 'file.flagged':
      return `File flagged: ${data.fileName ?? data.fileId ?? 'unknown'}`
    case 'file.deleted':
      return `File deleted: ${data.name ?? data.fileId ?? 'unknown'}`
    case 'file.visibility_changed':
      return `File visibility changed: ${data.isPublic ? 'public' : 'private'} (${data.fileId ?? 'unknown'})`
    case 'share_link.created':
      return `Share link created for ${data.fileId ?? 'unknown'}`
    case 'share_link.revoked':
      return `Share link revoked for ${data.fileId ?? 'unknown'}`
    case 'ticket.created':
      return `Ticket created: ${data.subject ?? data.ticketId ?? 'unknown'}`
    case 'ticket.replied':
      return `Ticket replied: ${data.ticketId ?? 'unknown'}`
    case 'ticket.closed':
      return `Ticket closed: ${data.ticketId ?? 'unknown'}`
    case 'ticket.reopened':
      return `Ticket reopened: ${data.ticketId ?? 'unknown'}`
    case 'user.signed_up':
      return `New user signed up: ${data.name ?? data.userId ?? 'unknown'}`
    case 'user.suspended':
      return `User suspended: ${data.userId ?? 'unknown'}`
    case 'user.terminated':
      return `User terminated: ${data.userId ?? 'unknown'}`
    case 'user.deleted':
      return `User deleted: ${data.userId ?? 'unknown'}`
    case 'user.warning_acknowledged':
      return `Warning acknowledged by ${data.userId ?? 'unknown'}`
    case 'user.appeal_approved':
      return `Appeal approved for ${data.userId ?? data.appealId ?? 'unknown'}`
    case 'user.appeal_rejected':
      return `Appeal rejected for ${data.userId ?? data.appealId ?? 'unknown'}`
    case 'storage.request_approved':
      return `Storage request approved: ${data.requestId ?? 'unknown'}`
    case 'storage.request_rejected':
      return `Storage request rejected: ${data.requestId ?? 'unknown'}`
    case 'deletion.request_approved':
      return `Deletion request approved: ${data.requestId ?? 'unknown'}`
    case 'deletion.request_rejected':
      return `Deletion request rejected: ${data.requestId ?? 'unknown'}`
    case 'admin.hash_flagged':
      return `Hash flagged: ${data.hash ?? 'unknown'}`
    case 'admin.takedown_approved':
      return `Takedown approved: ${data.requestId ?? 'unknown'}`
    case 'ai.daily_limit_warning':
      return `AI daily limit warning: $${data.usedToday?.toFixed?.(4) ?? data.usedToday} of $${data.limit?.toFixed?.() ?? data.limit}`
    case 'ai.daily_limit_exceeded':
      return `AI daily limit exceeded: $${data.usedToday?.toFixed?.(4) ?? data.usedToday} of $${data.limit?.toFixed?.() ?? data.limit}`
    case 'api.key.created':
      return `API key created: ${data.name ?? 'unknown'}`
    case 'api.key.deleted':
      return `API key deleted: ${data.keyId ?? 'unknown'}`
    case 'webhook.test':
      return `Webhook test event received`
    default:
      if (data.message) return String(data.message)
      if (data.subject) return String(data.subject)
      if (data.reason) return String(data.reason)
      return `Event: ${event}`
  }
}
