import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { v4 as uuidv4 } from 'uuid'
import { headers } from 'next/headers'

export function getClientIP(headersList: Headers): string {
  return headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headersList.get('x-real-ip')
    ?? 'unknown'
}

export function getClientUA(headersList: Headers): string {
  return headersList.get('user-agent') ?? 'unknown'
}

export async function logAuditEvent(
  userId: string,
  action: string,
  details?: string,
  ip?: string,
  ua?: string,
) {
  await db.insert(auditLog).values({
    id: uuidv4(),
    userId,
    action,
    details: details ?? null,
    ipAddress: ip ?? null,
    userAgent: ua ?? null,
  }).catch(() => {})
}

export async function logAuditEventWithHeaders(
  userId: string,
  action: string,
  details?: string,
) {
  const h = await headers()
  await logAuditEvent(userId, action, details, getClientIP(h), getClientUA(h))
}
