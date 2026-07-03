'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logAuditEventWithHeaders } from '@/lib/audit'
import { fireWebhook } from '@/lib/webhooks/fire'

export type AccountStatus =
  | { warned: false; suspended: false }
  | { warned: true; suspended: false; reason: string | null }
  | { warned: false; suspended: true; reason: string | null }

/**
 * Check if the current user's account has been warned or suspended.
 * Returns the account status without revealing the warning count.
 */
export async function getAccountStatus(): Promise<AccountStatus | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const [u] = await db
    .select({
      banned: user.banned,
      suspensionReason: user.suspensionReason,
      suspensionType: user.suspensionType,
    })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u) return null

  if (u.banned && u.suspensionType === 'suspended') {
    return {
      warned: false,
      suspended: true,
      reason: u.suspensionReason,
    }
  }

  if (u.banned && u.suspensionType === 'warned') {
    return {
      warned: true,
      suspended: false,
      reason: u.suspensionReason,
    }
  }

  return { warned: false, suspended: false }
}

/**
 * Acknowledge a warning and reactivate the account.
 * This clears the warned/banned state but preserves the warning count.
 * Only works if the account is warned (not suspended).
 */
export async function acknowledgeWarning() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  // Only allow reactivation if account is warned (not suspended)
  const [u] = await db
    .select({ suspensionType: user.suspensionType })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (u?.suspensionType === 'suspended') {
    throw new Error('Account is suspended and cannot be reactivated. Please contact support.')
  }

  await db
    .update(user)
    .set({
      banned: false,
      suspensionReason: null,
      suspensionType: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id))

  await logAuditEventWithHeaders(
    session.user.id,
    'account.warning_acknowledged',
    JSON.stringify({})
  )
  await fireWebhook(session.user.id, 'user.warning_acknowledged', {}).catch(() => undefined)

  return { ok: true }
}
