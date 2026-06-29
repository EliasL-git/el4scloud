'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { storageRequests, account } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function getVerificationStatus() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [pendingCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(storageRequests)
    .where(
      and(
        eq(storageRequests.userId, session.user.id),
        eq(storageRequests.status, 'pending'),
      )
    )

  const [hcAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, 'hackclub'),
      )
    )

  return {
    hasPendingRequest: pendingCount.count > 0,
    hasHackClubAccount: !!hcAccount,
  }
}
