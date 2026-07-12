'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { broadcasts, broadcastAcknowledgements } from '@/lib/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function getUnseenBroadcasts() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return []

  const all = await db
    .select()
    .from(broadcasts)
    .orderBy(desc(broadcasts.createdAt))
    .limit(10)

  let ackedIds = new Set<string>()
  try {
    const ackRows = await db
      .select({ broadcastId: broadcastAcknowledgements.broadcastId })
      .from(broadcastAcknowledgements)
      .where(eq(broadcastAcknowledgements.userId, session.user.id))
    ackedIds = new Set(ackRows.map((r) => r.broadcastId))
  } catch {
    // table doesn't exist yet
  }

  return all.filter((b) => !ackedIds.has(b.id))
}

export async function acknowledgeBroadcast(broadcastId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return

  try {
    await db.insert(broadcastAcknowledgements).values({
      id: uuidv4(),
      broadcastId,
      userId: session.user.id,
    })
  } catch {
    // table doesn't exist yet
  }
}

export async function acknowledgeAllBroadcasts() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return

  try {
    const all = await db.select({ id: broadcasts.id }).from(broadcasts)
    const values = all.map((b) => ({
      id: uuidv4(),
      broadcastId: b.id,
      userId: session.user.id,
    }))
    if (values.length > 0) {
      await db.insert(broadcastAcknowledgements).values(values)
    }
  } catch {
    // table doesn't exist yet
  }
}
