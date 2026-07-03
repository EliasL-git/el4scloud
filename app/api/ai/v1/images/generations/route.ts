import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, aiUsage } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { FREE_DAILY_USD_LIMIT } from '@/lib/ai'

const IMAGE_COST = 0.01

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [u] = await db
    .select({ verifiedViaHackclub: user.verifiedViaHackclub })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u?.verifiedViaHackclub) {
    return Response.json({ error: 'Only Hack Club students can access AI features.' }, { status: 403 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const [usageResult] = await db
    .select({ used: sql<number>`COALESCE(SUM("cost"), 0)::real` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, session.user.id), sql`"createdAt" >= ${todayStart.toISOString()}`))

  const usedToday = usageResult?.used ?? 0
  if (usedToday + IMAGE_COST > FREE_DAILY_USD_LIMIT) {
    return Response.json({ error: `This image request costs $${IMAGE_COST} but exceeds your remaining daily budget.` }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return Response.json({ error: 'prompt is required' }, { status: 400 })
  }

  const apiKey = process.env.DIGITALOCEAN_AI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'AI API key not configured' }, { status: 500 })
  }

  const doRes = await fetch('https://inference.do-ai.run/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: body.model ?? 'flux-schnell',
      prompt: body.prompt.trim(),
      n: typeof body.n === 'number' ? Math.max(1, Math.min(body.n, 4)) : 1,
      size: body.size ?? '1024x1024',
    }),
  })

  if (!doRes.ok) {
    const text = await doRes.text()
    return Response.json({ error: `AI API error (${doRes.status}): ${text}` }, { status: doRes.status })
  }

  const data = await doRes.json()

  await db.insert(aiUsage).values({
    id: uuidv4(),
    userId: session.user.id,
    model: 'images',
    cost: IMAGE_COST,
  })

  return Response.json({
    id: uuidv4(),
    object: 'list',
    created: Math.floor(Date.now() / 1000),
    data: (data.data ?? []).map((item: any) => ({
      url: item.url,
      revised_prompt: item.revised_prompt ?? item.prompt ?? body.prompt,
    })),
  })
}
