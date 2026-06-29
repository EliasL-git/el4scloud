'use server'

import { db } from '@/lib/db'
import { user, account } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { NO_VERIFICATION_LIMIT } from '@/lib/storage'
import { auth } from '@/lib/auth'

export async function register(data: {
  name: string
  email: string
  password: string
}) {
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, data.email))
  if (existingUser) {
    return { error: 'An account with this email already exists.' }
  }

  const userId = uuidv4()
  const hashedPassword = await bcrypt.hash(data.password, 10)

  await db.insert(user).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified: false,
    role: 'user',
    storageLimit: NO_VERIFICATION_LIMIT,
    agreedToTerms: true,
  })

  await db.insert(account).values({
    id: uuidv4(),
    userId,
    accountId: data.email,
    providerId: 'email',
    password: hashedPassword,
  })

  try {
    const hdrs = await headers()
    const cleanHeaders = new Headers(hdrs)
    cleanHeaders.delete('cookie')
    await auth.api.sendVerificationEmail({
      headers: cleanHeaders,
      body: { email: data.email, callbackURL: '/dashboard' },
    })
  } catch (err: any) {
    console.error('[register] Failed to send verification email:', err?.message ?? err)
  }

  return {
    ok: true,
    needsVerification: true,
    email: data.email,
  }
}
