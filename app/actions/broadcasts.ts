'use server'

import { db } from '@/lib/db'
import { broadcasts } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function getRecentBroadcasts() {
  return db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(10)
}
