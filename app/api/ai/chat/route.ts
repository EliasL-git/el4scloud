import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, aiUsage } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { AI_MODELS, FREE_DAILY_USD_LIMIT, calculateCost } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json()
    const messages = body.messages as { role: string; content: string }[]
    const selectedModel: string = body.model ?? 'deepseek-4-flash'

    const modelIndex = AI_MODELS.findIndex((m) => m.id === selectedModel)
    if (modelIndex === -1) {
      return Response.json({ error: 'Invalid model' }, { status: 400 })
    }
    const nextModel = AI_MODELS[modelIndex + 1]?.id

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const [usageResult] = await db
      .select({ used: sql<number>`COALESCE(SUM("cost"), 0)::real` })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, session.user.id), sql`"createdAt" >= ${todayStart.toISOString()}`))

    const usedToday = usageResult?.used ?? 0
    if (usedToday >= FREE_DAILY_USD_LIMIT) {
      return Response.json({ error: `Daily budget of $${FREE_DAILY_USD_LIMIT.toFixed(2)} used up. Resets at midnight UTC.` }, { status: 429 })
    }

    const apiKey = process.env.DIGITALOCEAN_AI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'AI API key not configured' }, { status: 500 })
    }

    let doModel = selectedModel
    let didFallback = false

    const doFetch = (m: string) =>
      fetch('https://inference.do-ai.run/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'system', content: 'You are a helpful assistant.' }, ...messages],
          max_tokens: body.maxTokens ?? 2048,
          temperature: body.temperature ?? 0.7,
          stream: true,
        }),
      })

    let doRes = await doFetch(doModel)

    if (doRes.status === 429 && nextModel) {
      doModel = nextModel
      didFallback = true
      doRes = await doFetch(doModel)
    }

    if (!doRes.ok) {
      const text = await doRes.text()
      return Response.json({ error: `AI API error (${doRes.status}): ${text}` }, { status: doRes.status })
    }

    const encoder = new TextEncoder()
    let fullContent = ''

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    ;(async () => {
      const reader = doRes.body!.getReader()
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          for (const line of text.split('\n')) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) fullContent += delta
              } catch {}
            }
          }
          await writer.write(value)
        }
      } catch (e) {
        console.error('[ai:stream]', e)
      } finally {
        reader.releaseLock()
        const promptTokens = Math.ceil(messages.map((m) => m.content).join(' ').length / 4)
        const completionTokens = Math.ceil(fullContent.length / 4) || 1
        const cost = calculateCost(doModel, promptTokens, completionTokens)

        if (usedToday + cost <= FREE_DAILY_USD_LIMIT) {
          await db.insert(aiUsage).values({ id: uuidv4(), userId: session.user.id, model: doModel, cost })
        }

        const meta = JSON.stringify({
          _meta: true,
          usedModel: doModel,
          didFallback,
          fallbackFrom: didFallback ? selectedModel : undefined,
          cost,
          usedToday: usedToday + cost,
          limit: FREE_DAILY_USD_LIMIT,
        })
        await writer.write(encoder.encode(`data: ${meta}\n\n`))
        await writer.write(encoder.encode('data: [DONE]\n\n'))
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (err: any) {
    console.error('[ai:stream:error]', err?.message ?? err)
    return Response.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
