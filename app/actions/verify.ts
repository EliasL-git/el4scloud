'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function resendVerificationEmail(email: string) {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })

  // Build clean headers (no cookies) for the anonymous path
  const cleanHeaders = new Headers(hdrs)
  cleanHeaders.delete('cookie')

  try {
    const result = await auth.api.sendVerificationEmail({
      headers: session ? hdrs : cleanHeaders,
      body: { email, callbackURL: '/dashboard' },
    })
    return { ok: true, result }
  } catch (err: any) {
    console.error('[verify] Failed to send verification email:', err?.message ?? err)
    return { ok: false, error: err?.message ?? 'Failed to send verification email' }
  }
}
