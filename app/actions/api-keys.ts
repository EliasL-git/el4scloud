'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'

import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createHash, randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { logAuditEventWithHeaders } from '@/lib/audit'
import { fireWebhook } from '@/lib/webhooks/fire'
import { assertNotSuspended } from '@/lib/suspension'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  await assertNotSuspended(session.user.id)
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
  const rawKey = `sk_${randomBytes(32).toString('hex')}`
  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 10)
  const id = uuidv4()

  await db.insert(apiKeys).values({
    id,
    userId,
    name,
    keyHash,
    keyPrefix,
  })

  revalidatePath('/dashboard/keys')

  await logAuditEventWithHeaders(userId, 'apikey.created', JSON.stringify({ name, keyId: id, keyPrefix }))

  await fireWebhook(userId, 'api.key.created', { keyId: id, name }).catch(() => undefined)

  return rawKey
}

export async function deleteApiKey(keyId: string) {
  const userId = await getUserId()

  const [existing] = await db.select({ name: apiKeys.name }).from(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))

  await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))

  await logAuditEventWithHeaders(userId, 'apikey.deleted', JSON.stringify({ keyId }))

  await fireWebhook(userId, 'api.key.deleted', { keyId, name: existing?.name }).catch(() => undefined)

  revalidatePath('/dashboard/keys')
}
