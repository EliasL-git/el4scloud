'use server'

import { db } from '@/lib/db'
import { user, account, session, accessCodes } from '@/lib/db/schema'
import { eq, and, or, isNull, gt } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function registerWithAccessCode(data: {
  code: string
  name: string
  email: string
  password: string
}) {
  // 1. Validate access code
  const [code] = await db
    .select()
    .from(accessCodes)
    .where(
      and(
        eq(accessCodes.code, data.code),
        eq(accessCodes.isActive, true),
        or(
          isNull(accessCodes.expiresAt),
          gt(accessCodes.expiresAt, new Date())
        )
      )
    )

  if (!code) {
    return { error: 'Invalid or expired access code.' }
  }
  if (code.usedCount >= code.maxUses) {
    return { error: 'This access code has reached its maximum uses.' }
  }

  // 2. Check if email already exists
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, data.email))
  if (existingUser) {
    return { error: 'An account with this email already exists.' }
  }

  // 3. Create user
  const userId = uuidv4()
  const hashedPassword = await bcrypt.hash(data.password, 10)

  await db.insert(user).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified: true,
    role: 'user',
  })

  // 4. Create account record (so Better Auth knows about the email/password login)
  await db.insert(account).values({
    id: uuidv4(),
    userId,
    accountId: data.email,
    providerId: 'email',
    password: hashedPassword,
  })

  // 5. Increment access code usage
  await db
    .update(accessCodes)
    .set({ usedCount: code.usedCount + 1, updatedAt: new Date() })
    .where(eq(accessCodes.id, code.id))

  // 6. Create session
  const sessionToken = uuidv4()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.insert(session).values({
    id: uuidv4(),
    token: sessionToken,
    userId,
    expiresAt,
  })

  // 7. Set session cookie — Better Auth default format
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
