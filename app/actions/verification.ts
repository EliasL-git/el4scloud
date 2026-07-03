'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { storageRequests, user } from '@/lib/db/schema'
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

  const [u] = await db
    .select({ verifiedViaHackclub: user.verifiedViaHackclub })
    .from(user)
    .where(eq(user.id, session.user.id))

  return {
    hasPendingRequest: pendingCount.count > 0,
    hasHackClubAccount: u?.verifiedViaHackclub ?? false,
  }
}
