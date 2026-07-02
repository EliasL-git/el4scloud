import { betterAuth } from 'better-auth'
import { pool, db } from '@/lib/db'
import { verification } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { sendMail } from '@/lib/mail'

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined

const baseURL =
  process.env.BETTER_AUTH_URL ?? productionUrl ?? vercelUrl ?? 'https://cloud.el4s.dev'

const trustedOrigins = [
  'http://localhost:3000',
  'https://cloud.el4s.dev',
  'https://auth.hackclub.com',
  ...(vercelUrl ? [vercelUrl] : []),
  ...(productionUrl ? [productionUrl] : []),
]

const noEmail = process.env.NO_EMAIL === 'true'

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
    requireEmailVerification: !noEmail,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        const { renderToString } = await import('react-dom/server')
        const { ResetPasswordEmail } = await import('@/components/emails/reset-password')
        const html = renderToString(ResetPasswordEmail({ username: user.name, resetUrl: url }))
        await sendMail({ to: user.email, subject: 'Reset your password', html })
      } catch (err: any) {
        console.error('[auth:sendResetPassword] Failed:', err?.message ?? err)
      }
    },
  },
  ...(noEmail
    ? {}
    : {
        emailVerification: {
          sendOnSignUp: false,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({ user }) => {
            const code = generateCode()
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

            await db.delete(verification).where(eq(verification.identifier, user.email))
            await db.insert(verification).values({
              id: uuidv4(),
              identifier: user.email,
              value: code,
              expiresAt,
            })

            try {
              const { renderToString } = await import('react-dom/server')
              const { VerifyEmailEmail } = await import('@/components/emails/verify-email')
              const html = renderToString(VerifyEmailEmail({ username: user.name, code }))
              await sendMail({ to: user.email, subject: 'Your verification code', html })
            } catch (err: any) {
              console.error('[auth:sendVerificationEmail] Failed:', err?.message ?? err)
            }
          },
        },
      }),

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
