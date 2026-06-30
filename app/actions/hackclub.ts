'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { cookies } from 'next/headers'
import crypto from 'crypto'

function getBaseUrl(hdrs: Headers): string {
  if (process.env.HOST_URL) {
    let hostUrl = process.env.HOST_URL
    if (!hostUrl.startsWith('http://') && !hostUrl.startsWith('https://')) {
      hostUrl = `https://${hostUrl}`
    }
    return hostUrl
  }
  const host = hdrs.get('host') || 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  return `${proto}://${host}`
}

export async function getHackClubAuthUrl() {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })
  if (!session?.user) throw new Error('Unauthorized')

  const baseUrl = getBaseUrl(hdrs)

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
    redirect_uri: `${baseUrl}/api/auth/oauth2/callback/hackclub`,
    scope: 'openid profile email verification_status',
    state,
  })

  return { url: `https://auth.hackclub.com/oauth/authorize?${params}` }
}
