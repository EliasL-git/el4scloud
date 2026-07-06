'use server'

import { db } from '@/lib/db'
import { user, account } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { hashPassword } from 'better-auth/crypto'
import { NO_VERIFICATION_LIMIT } from '@/lib/storage'
import { fireWebhook } from '@/lib/webhooks/fire'
import { disposableEmailDomains } from '@/lib/disposable-emails'

export async function register(data: {
  name: string
  email: string
  password: string
}) {
  const domain = data.email.split('@').pop()?.toLowerCase()
  if (domain && disposableEmailDomains.has(domain)) {
    return { error: 'Temporary email addresses are not allowed. Please use a permanent email address.' }
  }

  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, data.email))
  if (existingUser) {
    return { error: 'An account with this email already exists.' }
  }

  const userId = uuidv4()
  const hashedPassword = await hashPassword(data.password)

  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: data.name,
        email: data.email,
        emailVerified: false,
        role: 'user',
        storageLimit: NO_VERIFICATION_LIMIT,
        agreedToTerms: true,
      })

      await tx.insert(account).values({
        id: uuidv4(),
        userId,
        accountId: userId,
        providerId: 'credential',
        password: hashedPassword,
      })
    })
  } catch (err: any) {
    return { error: 'Registration failed. Please try again.' }
  }

  await fireWebhook(userId, 'user.signed_up', { userId }).catch(() => undefined)

  return { ok: true, needsVerification: true, email: data.email }
}
