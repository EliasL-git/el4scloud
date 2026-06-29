'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, verification } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function resendVerificationEmail(email: string) {
  console.log('[verify:resend] Request for:', email)

  // Rate limit: check verification table for entries created within 2h
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const [existing] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, email))
    .orderBy(verification.createdAt)
    .limit(1)

  if (existing && existing.createdAt && new Date(existing.createdAt) > twoHoursAgo) {
    const elapsed = Date.now() - new Date(existing.createdAt).getTime()
    const remainingMs = 2 * 60 * 60 * 1000 - elapsed
    const remainingMin = Math.ceil(remainingMs / 60000)
    console.log('[verify:resend] Rate limited —', remainingMin, 'minutes remaining')
    return {
      ok: false,
      error: `Please wait ${remainingMin} minute${remainingMin === 1 ? '' : 's'} before requesting a new code.`,
    }
  }

  // Build headers without cookies for the anonymous verification path
  const hdrs = await headers()
  const cleanHeaders = new Headers(hdrs)
  cleanHeaders.delete('cookie')

  try {
    await auth.api.sendVerificationEmail({
      headers: cleanHeaders,
      body: { email },
    })
    console.log('[verify:resend] Verification email sent to:', email)
    return { ok: true }
  } catch (err: any) {
    console.error('[verify:resend] Failed:', err?.message ?? err)
    if (err?.message === 'Email already verified') {
      return { ok: false, error: 'This email is already verified.' }
    }
    return { ok: false, error: err?.message ?? 'Failed to send verification email.' }
  }
}

export async function verifyEmailCode(email: string, code: string) {
  console.log('[verify:verifyCode] Verifying code for:', email, 'code:', code)

  // Look up verification entry
  const [entry] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, email))
    .orderBy(verification.createdAt)
    .limit(1)

  if (!entry) {
    console.log('[verify:verifyCode] No verification entry found')
    return { ok: false, error: 'No verification code found. Request a new one.' }
  }

  // Check expiry
  if (new Date(entry.expiresAt) < new Date()) {
    console.log('[verify:verifyCode] Code expired')
    await db.delete(verification).where(eq(verification.identifier, email))
    return { ok: false, error: 'Verification code has expired. Request a new one.' }
  }

  // Check code match
  if (entry.value !== code) {
    console.log('[verify:verifyCode] Code mismatch')
    return { ok: false, error: 'Invalid verification code. Please check and try again.' }
  }

  // Code is valid — update user's emailVerified
  console.log('[verify:verifyCode] Code valid, updating emailVerified for:', email)
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email))

  // Delete the verification entry
  await db.delete(verification).where(eq(verification.identifier, email))

  console.log('[verify:verifyCode] Email verified successfully:', email)
  return { ok: true }
}
