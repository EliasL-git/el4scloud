import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function assertNotSuspended(userId: string) {
  const [u] = await db
    .select({ banned: user.banned, suspensionType: user.suspensionType })
    .from(user)
    .where(eq(user.id, userId))

  if (!u) throw new Error('User not found')

  if (u.banned && u.suspensionType === 'warned') {
    throw new Error('Your account has been warned. Please reactivate your account.')
  }

  if (u.banned && (u.suspensionType === 'suspended' || u.suspensionType === 'terminated')) {
    throw new Error('Your account has been suspended.')
  }
}

export async function isSuspended(userId: string) {
  const [u] = await db
    .select({ banned: user.banned, suspensionType: user.suspensionType })
    .from(user)
    .where(eq(user.id, userId))

  if (!u) return true
  return !!(u.banned && u.suspensionType && u.suspensionType !== 'warned')
}
