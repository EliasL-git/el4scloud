'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, verification } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { auth } from '@/lib/auth'
import { NO_VERIFICATION_LIMIT, MANUAL_VERIFICATION_LIMIT } from '@/lib/storage'

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
  const [existingUser] = await db
    .select({ storageLimit: user.storageLimit })
    .from(user)
    .where(eq(user.email, email))

  const updates: Record<string, any> = { emailVerified: true }
  // If user was on the 100 MB no-verification tier, upgrade to 2.5 GB
  if (existingUser && existingUser.storageLimit === NO_VERIFICATION_LIMIT) {
    console.log('[verify:verifyCode] Upgrading storage from 100 MB to 2.5 GB')
    updates.storageLimit = MANUAL_VERIFICATION_LIMIT
  }

  await db.update(user).set(updates).where(eq(user.email, email))

  // Delete the verification entry
  await db.delete(verification).where(eq(verification.identifier, email))

  console.log('[verify:verifyCode] Email verified successfully:', email)
  return { ok: true }
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendUpgradeCode(email: string) {
  console.log('[verify:sendUpgradeCode] Sending upgrade code to:', email)

  // Rate limit: check verification table for entries created within 2h
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const identifier = `${email}:upgrade`
  const [existing] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .orderBy(verification.createdAt)
    .limit(1)

  if (existing && existing.createdAt && new Date(existing.createdAt) > twoHoursAgo) {
    const elapsed = Date.now() - new Date(existing.createdAt).getTime()
    const remainingMs = 2 * 60 * 60 * 1000 - elapsed
    const remainingMin = Math.ceil(remainingMs / 60000)
    console.log('[verify:sendUpgradeCode] Rate limited —', remainingMin, 'minutes remaining')
    return {
      ok: false,
      error: `Please wait ${remainingMin} minute${remainingMin === 1 ? '' : 's'} before requesting a new code.`,
    }
  }

  // Look up user name
  const [u] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.email, email))

  if (!u) {
    return { ok: false, error: 'User not found.' }
  }

  // Generate and store code
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.delete(verification).where(eq(verification.identifier, identifier))
  await db.insert(verification).values({
    id: uuidv4(),
    identifier,
    value: code,
    expiresAt,
  })

  // Send email via Resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[verify:sendUpgradeCode] RESEND_API_KEY not set')
    return { ok: false, error: 'Email service not configured.' }
  }
  const from = process.env.RESEND_FROM || 'noreply@example.com'

  try {
    const { Resend } = await import('resend')
    const { VerifyEmailEmail } = await import('@/components/emails/verify-email')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: 'Upgrade your storage — verification code',
      react: VerifyEmailEmail({ username: u.name, code }),
    })
    if (error) {
      console.error('[verify:sendUpgradeCode] Resend error:', JSON.stringify(error))
      return { ok: false, error: 'Failed to send email.' }
    }
  } catch (err: any) {
    console.error('[verify:sendUpgradeCode] Exception:', err?.message ?? err)
    return { ok: false, error: 'Failed to send email.' }
  }

  console.log('[verify:sendUpgradeCode] Code sent successfully')
  return { ok: true }
}

export async function verifyUpgradeCode(email: string, code: string) {
  console.log('[verify:verifyUpgradeCode] Verifying upgrade code for:', email)

  const identifier = `${email}:upgrade`
  const [entry] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .orderBy(verification.createdAt)
    .limit(1)

  if (!entry) {
    console.log('[verify:verifyUpgradeCode] No verification entry found')
    return { ok: false, error: 'No verification code found. Request a new one.' }
  }

  if (new Date(entry.expiresAt) < new Date()) {
    console.log('[verify:verifyUpgradeCode] Code expired')
    await db.delete(verification).where(eq(verification.identifier, identifier))
    return { ok: false, error: 'Verification code has expired. Request a new one.' }
  }

  if (entry.value !== code) {
    console.log('[verify:verifyUpgradeCode] Code mismatch')
    return { ok: false, error: 'Invalid verification code. Please check and try again.' }
  }

  // Upgrade storage to 2.5 GB
  console.log('[verify:verifyUpgradeCode] Code valid, upgrading storage for:', email)
  await db.update(user).set({ storageLimit: MANUAL_VERIFICATION_LIMIT }).where(eq(user.email, email))
  await db.delete(verification).where(eq(verification.identifier, identifier))

  console.log('[verify:verifyUpgradeCode] Storage upgraded successfully')
  return { ok: true }
}
