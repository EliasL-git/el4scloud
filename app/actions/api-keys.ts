'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { ensureCredits, CREDIT_COSTS } from '@/lib/credits'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createHash, randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export async function getApiKeys() {
  const userId = await getUserId()
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt))
}

export async function createApiKey(name: string) {
  const userId = await getUserId()
  await ensureCredits(userId, CREDIT_COSTS.CREATE_API_KEY)

  const rawKey = `sk_${randomBytes(32).toString('hex')}`
  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 10)

  await db.insert(apiKeys).values({
    id: uuidv4(),
    userId,
    name,
    keyHash,
    keyPrefix,
  })

  revalidatePath('/dashboard/keys')

  // Return the raw key only once — it won't be retrievable again
  return rawKey
}

export async function deleteApiKey(keyId: string) {
  const userId = await getUserId()
  await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
  revalidatePath('/dashboard/keys')
}
