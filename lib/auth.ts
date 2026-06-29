import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'
import { VerifyEmailEmail } from '@/components/emails/verify-email'

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
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log('[auth:sendVerificationEmail] Preparing to send verification email...')
      console.log('[auth:sendVerificationEmail] User:', { id: user.id, email: user.email, name: user.name })
      console.log('[auth:sendVerificationEmail] Verification URL:', url)
      console.log('[auth:sendVerificationEmail] RESEND_FROM:', process.env.RESEND_FROM)
      console.log('[auth:sendVerificationEmail] RESEND_API_KEY set?', !!process.env.RESEND_API_KEY)

      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        console.error('[auth:sendVerificationEmail] RESEND_API_KEY is not set — cannot send email')
        return
      }

      const from = process.env.RESEND_FROM || 'noreply@example.com'
      console.log('[auth:sendVerificationEmail] Sending via Resend from:', from, 'to:', user.email)

      try {
        const { Resend } = await import('resend')
        const resend = new Resend(apiKey)
        const { data, error } = await resend.emails.send({
          from,
          to: user.email,
          subject: 'Verify your email',
          react: VerifyEmailEmail({ username: user.name, verificationUrl: url }),
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
