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
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY ?? '')
      await resend.emails.send({
        from: process.env.RESEND_FROM ?? 'noreply@example.com',
        to: user.email,
        subject: 'Verify your email',
        react: VerifyEmailEmail({ username: user.name, verificationUrl: url }),
      })
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
