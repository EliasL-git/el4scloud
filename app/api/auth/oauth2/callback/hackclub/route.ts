import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { account } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const storedState = request.cookies.get('hc_oauth_state')?.value

  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=invalid_state', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=no_code', request.url))
  }

  const origin = (() => {
    if (process.env.HOST_URL) {
      let hostUrl = process.env.HOST_URL
      if (!hostUrl.startsWith('http://') && !hostUrl.startsWith('https://')) {
        hostUrl = `https://${hostUrl}`
      }
      return hostUrl
    }
    return new URL(request.url).origin
  })()

  const tokenResponse = await fetch('https://auth.hackclub.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origin}/api/auth/oauth2/callback/hackclub`,
      client_id: process.env.HACKCLUB_CLIENT_ID,
      client_secret: process.env.HACKCLUB_CLIENT_SECRET,
    }),
  })

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=token_failed', request.url))
  }

  const tokens = await tokenResponse.json()
  const accessToken = tokens.access_token

  const userInfoResponse = await fetch('https://auth.hackclub.com/api/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!userInfoResponse.ok) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=userinfo_failed', request.url))
  }

  const data = await userInfoResponse.json()
  const identity = data.identity as Record<string, unknown> | undefined
  if (!identity) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=no_identity', request.url))
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=not_authenticated', request.url))
  }

  const hcUserId = String(identity.id)

  // Only look for an existing *hackclub* account row — never touch the email credential row
  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'hackclub')))

  if (existing) {
    await db
      .update(account)
      .set({ accountId: hcUserId, accessToken, updatedAt: new Date() })
      .where(eq(account.id, existing.id))
  } else {
    await db.insert(account).values({
      id: uuidv4(),
      userId: session.user.id,
      accountId: hcUserId,
      providerId: 'hackclub',
      accessToken,
    })
  }

  const response = NextResponse.redirect(new URL('/dashboard/settings?hc=linked', request.url))
  response.cookies.delete('hc_oauth_state')
  return response
}
