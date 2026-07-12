'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getUserIntroductionStatus() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { signedIn: false as const }
  const [u] = await db
    .select({ suspensionType: user.suspensionType, emailVerified: user.emailVerified, banned: user.banned })
    .from(user)
    .where(eq(user.id, session.user.id))
  if (!u) return { signedIn: false as const }
  return {
    signedIn: true as const,
    emailVerified: u.emailVerified,
    suspensionType: u.suspensionType,
    banned: u.banned,
  }
}

export async function submitIntroduction(text: string) {
  const _check = process.env.NO_EMAIL?.trim().toLowerCase()
  if (!(_check === 'true' || _check === '1' || _check === 'yes')) {
    return { error: 'Not available.' }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Unauthorized' }

  const [u] = await db
    .select({ banned: user.banned, suspensionType: user.suspensionType, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u) return { error: 'User not found' }
  if (u.emailVerified) return { error: 'Already verified.' }
  if (u.suspensionType === 'pending_intro') {
    return { error: 'Your introduction is pending admin review.' }
  }

  const trimmed = text.trim()
  if (trimmed.length < 50) {
    return { error: 'Please write at least 50 characters about yourself and why you want to use this service.' }
  }
  if (trimmed.length > 2000) {
    return { error: 'Introduction must be under 2000 characters.' }
  }

  await db.update(user).set({ introductionText: trimmed, suspensionType: 'pending_intro', suspensionReason: 'Awaiting admin review.' }).where(eq(user.id, session.user.id))

  return { locked: true, reason: 'Your introduction will be reviewed by an admin.' }
}
