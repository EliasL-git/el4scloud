'use server'

import { db } from '@/lib/db'
import { user, account } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { NON_HC_STORAGE_LIMIT } from '@/lib/storage'
import { auth } from '@/lib/auth'

export async function register(data: {
  name: string
  email: string
  password: string
}) {
  // 1. Check if email already exists
  console.log('[register] Checking if email exists:', data.email)
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, data.email))
  if (existingUser) {
    console.log('[register] Email already exists:', data.email)
    return { error: 'An account with this email already exists.' }
  }

  // 2. Create user with email unverified
  console.log('[register] Creating user:', data.email)
  const userId = uuidv4()
  const hashedPassword = await bcrypt.hash(data.password, 10)

  await db.insert(user).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified: false,
    role: 'user',
    storageLimit: NON_HC_STORAGE_LIMIT,
    agreedToTerms: true,
  })

  // 3. Create account record (so Better Auth knows about the email/password login)
  console.log('[register] Creating account record for:', data.email)
  await db.insert(account).values({
    id: uuidv4(),
    userId,
    accountId: data.email,
    providerId: 'email',
    password: hashedPassword,
  })

  // 4. Send verification email via Better Auth
  console.log('[register] Sending verification email to:', data.email)
  try {
    // Strip cookies so Better Auth doesn't find an existing session
    // (session check would throw "Email mismatch" if the browser has
    // a cookie for a different user)
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

  return { ok: true, needsVerification: true, email: data.email }
}
