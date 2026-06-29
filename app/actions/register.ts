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
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, data.email))
  if (existingUser) {
    return { error: 'An account with this email already exists.' }
  }

  // 2. Create user with email unverified
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
  await db.insert(account).values({
    id: uuidv4(),
    userId,
    accountId: data.email,
    providerId: 'email',
    password: hashedPassword,
  })

  // 4. Send verification email via Better Auth
  try {
    const hdrs = await headers()
    await auth.api.sendVerificationEmail({
      headers: hdrs,
      body: { email: data.email },
    })
  } catch {
    // Email may fail; account is created but unverified
  }

  return { ok: true, needsVerification: true, email: data.email }
}
