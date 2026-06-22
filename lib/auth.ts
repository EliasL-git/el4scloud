import { betterAuth } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins/generic-oauth'
import { pool } from '@/lib/db'

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
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'hackclub',
          discoveryUrl: 'https://auth.hackclub.com/.well-known/openid-configuration',
          clientId: process.env.HACKCLUB_CLIENT_ID ?? '',
          clientSecret: process.env.HACKCLUB_CLIENT_SECRET ?? '',
          scopes: ['openid', 'profile', 'email', 'verification_status'],
          getUserInfo: async (tokens: { accessToken: string }) => {
            const res = await fetch('https://auth.hackclub.com/api/v1/me', {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            })
            const data = await res.json() as Record<string, unknown>
            const identity = data.identity as Record<string, unknown> | undefined
            if (!identity?.ysws_eligible) return null
            const displayName = String(identity.name ?? '')
            const givenName = String(identity.given_name ?? identity.first_name ?? '')
            const familyName = String(identity.family_name ?? identity.last_name ?? '')
            const nickname = String(identity.nickname ?? '')
            return {
              id: String(identity.id),
              email: String(identity.primary_email ?? ''),
              name: displayName || `${givenName} ${familyName}`.trim() || nickname || String(identity.primary_email ?? '').split('@')[0] || 'User',
            }
          },
          mapProfileToUser: (userInfo: Record<string, unknown>) => {
            const u = userInfo.user as Record<string, unknown> | undefined
            if (!u) return userInfo as Record<string, unknown>
            return u
          },
        },
      ],
    }),
  ],
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
