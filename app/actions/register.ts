'use server'

import { db } from '@/lib/db'
import { user, account } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { NO_VERIFICATION_LIMIT } from '@/lib/storage'
import { auth } from '@/lib/auth'
import type { VerificationMethod } from '@/lib/types'

export async function register(data: {
  name: string
  email: string
  password: string
  verificationMethod: VerificationMethod
}) {
  // 1. Check if email already exists
  console.log('[register] Checking if email exists:', data.email, 'method:', data.verificationMethod)
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, data.email))
  if (existingUser) {
    console.log('[register] Email already exists:', data.email)
    return { error: 'An account with this email already exists.' }
  }

  const emailVerified = data.verificationMethod === 'none'

  // 2. Create user
  console.log('[register] Creating user:', data.email, { emailVerified, storageLimit: NO_VERIFICATION_LIMIT })
  const userId = uuidv4()
  const hashedPassword = await bcrypt.hash(data.password, 10)

  await db.insert(user).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified,
    role: 'user',
    storageLimit: NO_VERIFICATION_LIMIT,
    agreedToTerms: true,
  })

  // 3. Create account record
  console.log('[register] Creating account record for:', data.email)
  await db.insert(account).values({
    id: uuidv4(),
    userId,
    accountId: data.email,
    providerId: 'email',
    password: hashedPassword,
  })

  // 4. Send verification email if manual verification
  if (data.verificationMethod === 'manual') {
    console.log('[register] Sending verification email to:', data.email)
    try {
      const hdrs = await headers()
      const cleanHeaders = new Headers(hdrs)
      cleanHeaders.delete('cookie')
      console.log('[register] Calling sendVerificationEmail...')
      const result = await auth.api.sendVerificationEmail({
        headers: cleanHeaders,
        body: { email: data.email, callbackURL: '/dashboard' },
      })
      console.log('[register] sendVerificationEmail result:', JSON.stringify(result))
    } catch (err: any) {
      console.error('[register] Failed to send verification email:', err?.message ?? err)
      if (err?.stack) {
        console.error('[register] Stack:', err.stack)
      }
    }
  }

  return {
    ok: true,
    needsVerification: data.verificationMethod === 'manual',
    email: data.email,
  }
}
