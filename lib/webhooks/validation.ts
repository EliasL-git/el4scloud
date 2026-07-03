import crypto from 'crypto'

const WEBHOOK_URL_DENYLIST = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254',
]

const ALLOWED_EVENTS = new Set([
  'file.uploaded',
  'file.scanned',
  'file.flagged',
  'file.deleted',
  'file.visibility_changed',
  'share_link.created',
  'share_link.revoked',
  'ticket.created',
  'ticket.replied',
  'ticket.closed',
  'ticket.reopened',
  'user.signed_up',
  'user.suspended',
  'user.terminated',
  'user.deleted',
  'user.warning_acknowledged',
  'user.appeal_approved',
  'user.appeal_rejected',
  'storage.request_approved',
  'storage.request_rejected',
  'deletion.request_approved',
  'deletion.request_rejected',
  'admin.hash_flagged',
  'admin.takedown_approved',
  'ai.daily_limit_warning',
  'ai.daily_limit_exceeded',
  'api.key.created',
  'api.key.deleted',
  'webhook.test',
])

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function validateWebhookUrl(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Webhook URL must use HTTP or HTTPS')
    }
    const host = parsed.hostname.toLowerCase()
    for (const blocked of WEBHOOK_URL_DENYLIST) {
      if (host === blocked || host.endsWith('.' + blocked)) {
        throw new Error('Webhook URL points to a blocked host')
      }
    }
  } catch (err: any) {
    throw new Error(`Invalid webhook URL: ${err.message}`)
  }
}

export function parseEvents(raw: string[]): string[] {
  const seen = new Set<string>()
  const events: string[] = []
  for (const e of raw) {
    const trimmed = e.trim()
    if (!trimmed) continue
    if (!ALLOWED_EVENTS.has(trimmed)) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    events.push(trimmed)
  }
  return events
}

export { ALLOWED_EVENTS }
