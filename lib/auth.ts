import { betterAuth } from 'better-auth'
import { pool, db } from '@/lib/db'
import { verification } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { VerifyEmailEmail } from '@/components/emails/verify-email'
import { ResetPasswordEmail } from '@/components/emails/reset-password'

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined

const baseURL =
  process.env.BETTER_AUTH_URL ?? productionUrl ?? vercelUrl ?? 'https://cloud.el4s.dev'

const trustedOrigins = [
  'http://localhost:3000',
  'https://cloud.el4s.dev',
  ...(vercelUrl ? [vercelUrl] : []),
  ...(productionUrl ? [productionUrl] : []),
]

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export const auth = betterAuth({
  database: pool,
  baseURL,
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  account: {
    accountLinking: {
      requireLocalEmailVerified: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      console.log('[auth:sendResetPassword] Sending password reset email to:', user.email)
      console.log('[auth:sendResetPassword] Reset URL:', url)

      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        console.error('[auth:sendResetPassword] RESEND_API_KEY is not set — cannot send email')
        return
      }
      const from = process.env.RESEND_FROM || 'noreply@example.com'

      try {
        const { Resend } = await import('resend')
        const resend = new Resend(apiKey)
        const { data, error } = await resend.emails.send({
          from,
          to: user.email,
          subject: 'Reset your password',
          react: ResetPasswordEmail({ username: user.name, resetUrl: url }),
        })

        if (error) {
          console.error('[auth:sendResetPassword] Resend API returned an error:', JSON.stringify(error))
        } else {
          console.log('[auth:sendResetPassword] Resend success, data:', JSON.stringify(data))
        }
      } catch (err: any) {
        console.error('[auth:sendResetPassword] Resend threw an exception:', err?.message ?? err)
        if (err?.stack) {
          console.error('[auth:sendResetPassword] Stack:', err.stack)
        }
      }
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user }) => {
      console.log('[auth:sendVerificationEmail] Preparing to send verification code...')
      console.log('[auth:sendVerificationEmail] User:', { id: user.id, email: user.email, name: user.name })

      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        console.error('[auth:sendVerificationEmail] RESEND_API_KEY is not set — cannot send email')
        return
      }
      const from = process.env.RESEND_FROM || 'noreply@example.com'

      // Generate and store 6-digit code
      const code = generateCode()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      console.log('[auth:sendVerificationEmail] Generated code:', code, 'expires:', expiresAt.toISOString())

      // Upsert verification entry (delete old, insert new)
      await db.delete(verification).where(eq(verification.identifier, user.email))
      await db.insert(verification).values({
        id: uuidv4(),
        identifier: user.email,
        value: code,
        expiresAt,
      })

      // Send email with code
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(apiKey)
        const { data, error } = await resend.emails.send({
          from,
          to: user.email,
          subject: 'Your verification code',
          react: VerifyEmailEmail({ username: user.name, code }),
        })

        if (error) {
          console.error('[auth:sendVerificationEmail] Resend API returned an error:', JSON.stringify(error))
        } else {
          console.log('[auth:sendVerificationEmail] Resend success, data:', JSON.stringify(data))
        }
      } catch (err: any) {
        console.error('[auth:sendVerificationEmail] Resend threw an exception:', err?.message ?? err)
        if (err?.stack) {
          console.error('[auth:sendVerificationEmail] Stack:', err.stack)
        }
      }
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    },
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
    },
  },
})
