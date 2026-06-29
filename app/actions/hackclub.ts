'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const BASE_URL = process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function getHackClubAuthUrl() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const state = crypto.randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('hc_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.HACKCLUB_CLIENT_ID ?? '',
    redirect_uri: `${BASE_URL}/api/auth/oauth2/callback/hackclub`,
    scope: 'openid profile email verification_status',
    state,
  })

  return { url: `https://auth.hackclub.com/oauth/authorize?${params}` }
}
