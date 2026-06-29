'use server'

import { db } from '@/lib/db'
import { user, account, session } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NON_HC_STORAGE_LIMIT } from '@/lib/storage'

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

  // 2. Create user with minimal storage limit
  const userId = uuidv4()
  const hashedPassword = await bcrypt.hash(data.password, 10)

  await db.insert(user).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified: true,
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

  // 4. Create session
  const sessionToken = uuidv4()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.insert(session).values({
    id: uuidv4(),
    token: sessionToken,
    userId,
    expiresAt,
  })

  // 5. Set session cookie — Better Auth default format
  const cookieStore = await cookies()
  cookieStore.set('better-auth.session_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return { ok: true }
}
