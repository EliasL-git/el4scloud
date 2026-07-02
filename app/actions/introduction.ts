'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function submitIntroduction(text: string) {
  const _check = process.env.NO_EMAIL?.trim().toLowerCase()
  if (!(_check === 'true' || _check === '1' || _check === 'yes')) {
    return { error: 'Not available.' }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Unauthorized' }

  const [u] = await db
    .select({ banned: user.banned, suspensionType: user.suspensionType, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u) return { error: 'User not found' }
  if (u.emailVerified) return { error: 'Already verified.' }
  if (u.banned && u.suspensionType === 'pending_intro') {
    return { error: 'Your introduction is pending admin review.' }
  }

  const trimmed = text.trim()
  if (trimmed.length < 50) {
    return { error: 'Please write at least 50 characters about yourself and why you want to use this service.' }
  }
  if (trimmed.length > 2000) {
    return { error: 'Introduction must be under 2000 characters.' }
  }

  const apiKey = process.env.DIGITALOCEAN_AI_API_KEY
  if (!apiKey) return { error: 'AI service not configured.' }

  try {
    const res = await fetch('https://inference.do-ai.run/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-4-flash',
        messages: [
          {
            role: 'system',
            content:
              'You evaluate user introductions for a cloud service. A valid introduction is at least 50 characters, written in good faith, explains who the person is and what they plan to use the service for. Reject spam, gibberish, copy-paste, offensive content, or obvious AI-generated text. Respond with valid JSON only: {"valid":true} or {"valid":false,"reason":"short explanation"}.',
          },
          { role: 'user', content: trimmed },
        ],
        max_tokens: 256,
        temperature: 0.1,
        stream: false,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[introduction] AI API error:', errText)
      return { error: 'Failed to verify introduction. Try again.' }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(content)

    // Store the intro text regardless of outcome
    await db.update(user).set({ introductionText: trimmed }).where(eq(user.id, session.user.id))

    if (parsed.valid === true) {
      await db
        .update(user)
        .set({ emailVerified: true, banned: false, suspensionType: null, suspensionReason: null })
        .where(eq(user.id, session.user.id))
      return { ok: true }
    }

    // Lock the account — one strike, admin must review
    const aiReason = parsed.reason ?? 'Introduction was not approved.'
    await db
      .update(user)
      .set({
        banned: true,
        suspensionType: 'pending_intro',
        suspensionReason: `AI rejected: ${aiReason}`,
      })
      .where(eq(user.id, session.user.id))

    return { locked: true, reason: aiReason }
  } catch (err: any) {
    console.error('[introduction] Error:', err?.message ?? err)
    return { error: 'Something went wrong. Try again.' }
  }
}
