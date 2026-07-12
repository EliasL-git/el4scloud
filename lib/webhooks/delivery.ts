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

  const embed = buildEmbed(event, data)

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
      body: JSON.stringify({
        username: 'Hobbycloud',
        ...payload,
        content: embed.description ?? '',
        embeds: [embed],
      }),
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

function embedColor(event: string): number {
  if (event.startsWith('file.')) return 0x3b82f6
  if (event.startsWith('user.')) return 0xef4444
  if (event.startsWith('ticket.')) return 0xf59e0b
  if (event.startsWith('storage.')) return 0x22c55e
  if (event.startsWith('deletion.')) return 0xef4444
  if (event.startsWith('share_link.')) return 0x8b5cf6
  if (event.startsWith('api.')) return 0x6366f1
  if (event.startsWith('admin.')) return 0xf97316
  if (event === 'webhook.test') return 0x10b981
  return 0x6b7280
}

function buildEmbed(event: string, data: Record<string, any>): {
  title: string
  description: string
  color: number
  timestamp: string
  fields?: { name: string; value: string; inline?: boolean }[]
} {
  const ts = new Date().toISOString()
  const base = { timestamp: ts, color: embedColor(event) }

  switch (event) {
    case 'file.uploaded':
      return { ...base, title: 'File Uploaded', description: 'A file was uploaded', fields: [data.size ? { name: 'Size', value: `${(data.size / 1024).toFixed(1)} KB`, inline: true } : undefined].filter(Boolean) as any }
    case 'file.scanned':
      return { ...base, title: 'File Scan Complete', description: `Result: ${data.scanResult ?? 'unknown'}` }
    case 'file.flagged':
      return { ...base, title: 'File Flagged', description: 'A file was flagged' }
    case 'file.deleted':
      return { ...base, title: 'File Deleted', description: 'A file was deleted' }
    case 'file.visibility_changed':
      return { ...base, title: 'File Visibility Changed', description: `Set to ${data.isPublic ? 'public' : 'private'}` }
    case 'share_link.created':
      return { ...base, title: 'Share Link Created', description: 'A share link was created' }
    case 'share_link.revoked':
      return { ...base, title: 'Share Link Revoked', description: 'A share link was revoked' }
    case 'ticket.created':
      return { ...base, title: 'Ticket Created', description: 'A support ticket was created', fields: [data.priority ? { name: 'Priority', value: data.priority, inline: true } : undefined].filter(Boolean) as any }
    case 'ticket.replied':
      return { ...base, title: 'Ticket Replied', description: 'A ticket received a reply' }
    case 'ticket.closed':
      return { ...base, title: 'Ticket Closed', description: 'A ticket was closed' }
    case 'ticket.reopened':
      return { ...base, title: 'Ticket Reopened', description: 'A ticket was reopened' }
    case 'user.signed_up':
      return { ...base, title: 'New User Signed Up', description: 'A new user registered' }
    case 'user.suspended':
      return { ...base, title: 'User Suspended', description: data.reason ?? 'Account suspended' }
    case 'user.terminated':
      return { ...base, title: 'User Terminated', description: data.reason ?? 'Account terminated' }
    case 'user.unsuspended':
      return { ...base, title: 'User Unsuspended', description: 'Account unsuspended' }
    case 'user.deleted':
      return { ...base, title: 'User Deleted', description: 'Account deleted' }
    case 'user.warning_acknowledged':
      return { ...base, title: 'Warning Acknowledged', description: 'A user acknowledged a warning' }
    case 'user.appeal_approved':
      return { ...base, title: 'Appeal Approved', description: 'An appeal was approved' }
    case 'user.appeal_rejected':
      return { ...base, title: 'Appeal Rejected', description: 'An appeal was rejected' }
    case 'storage.request_approved':
      return { ...base, title: 'Storage Request Approved', description: 'A storage request was approved', fields: data.approvedAmount ? [{ name: 'Amount', value: data.approvedAmount, inline: true }] : undefined }
    case 'storage.request_rejected':
      return { ...base, title: 'Storage Request Rejected', description: 'A storage request was rejected' }
    case 'deletion.request_approved':
      return { ...base, title: 'Deletion Request Approved', description: 'A deletion request was approved' }
    case 'deletion.request_rejected':
      return { ...base, title: 'Deletion Request Rejected', description: 'A deletion request was rejected' }
    case 'admin.hash_flagged':
      return { ...base, title: 'Hash Flagged', description: 'A file hash was flagged' }
    case 'admin.takedown_approved':
      return { ...base, title: 'Takedown Approved', description: 'A takedown request was approved' }
    case 'api.key.created':
      return { ...base, title: 'API Key Created', description: 'An API key was created' }
    case 'api.key.deleted':
      return { ...base, title: 'API Key Deleted', description: 'An API key was deleted' }
    case 'webhook.test':
      return { ...base, title: 'Webhook Test', description: 'Webhook test event received' }
    default:
      return { ...base, title: `Event: ${event}`, description: '' }
  }
}
