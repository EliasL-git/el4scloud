import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, aiUsage, aiConversations, aiMessages } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { AI_MODELS, FREE_DAILY_USD_LIMIT, calculateCost } from '@/lib/ai'
import { isSuspended } from '@/lib/suspension'

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000
const rateMap = new Map<string, number[]>()

function checkRateLimit(userId: string): number | null {
  const now = Date.now()
  const timestamps = rateMap.get(userId) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    return Math.max(0, RATE_WINDOW_MS - (now - recent[0]))
  }
  recent.push(now)
  rateMap.set(userId, recent)
  return null
}

function oaiId() {
  return `chatcmpl-${uuidv4().replace(/-/g, '').slice(0, 24)}`
}

async function checkAccess(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user) return { error: 'Unauthorized', status: 401 } as const
  if (await isSuspended(session.user.id)) return { error: 'Your account has been suspended.', status: 403 } as const
  const [u] = await db
    .select({ verifiedViaHackclub: user.verifiedViaHackclub })
    .from(user)
    .where(eq(user.id, session.user.id))
  if (!u?.verifiedViaHackclub) return { error: 'Only Hack Club students can access AI features.', status: 403 } as const

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const [usageResult] = await db
    .select({ used: sql<number>`COALESCE(SUM("cost"), 0)::real` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, session.user.id), sql`"createdAt" >= ${todayStart.toISOString()}`))

  const usedToday = usageResult?.used ?? 0
  if (usedToday >= FREE_DAILY_USD_LIMIT) {
    return { error: `Daily budget of $${FREE_DAILY_USD_LIMIT.toFixed(2)} used up. Resets at midnight UTC.`, status: 429 } as const
  }

  return { session, usedToday }
}

export async function POST(req: NextRequest) {
  try {
    const access = await checkAccess(req)
    if ('error' in access) {
      return Response.json({ error: access.error }, { status: access.status })
    }
    const { session, usedToday } = access

    const retryAfter = checkRateLimit(session.user.id)
    if (retryAfter !== null) {
      return Response.json({ error: `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)}s.` }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
      })
    }

    const body = await req.json()
    const messages = body.messages as { role: string; content: string }[]
    const selectedModel: string = body.model ?? 'deepseek-4-flash'
    const stream = body.stream !== false
    const maxTokens = body.max_tokens ?? body.maxTokens ?? 2048
    const temperature = body.temperature ?? 0.7
    let conversationId = body.conversation_id as string | undefined

    if (!conversationId) {
      conversationId = uuidv4()
      await db.insert(aiConversations).values({
        id: conversationId,
        userId: session.user.id,
        title: (messages.find((m) => m.role === 'user')?.content ?? 'New chat').slice(0, 60),
      })
    }

    const modelIndex = AI_MODELS.findIndex((m) => m.id === selectedModel)
    if (modelIndex === -1) {
      return Response.json({ error: 'Invalid model' }, { status: 400 })
    }
    const nextModel = AI_MODELS[modelIndex + 1]?.id

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
          max_tokens: maxTokens,
          temperature,
          stream,
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

    // ---- Non-streaming ----
    if (!stream) {
      const data = await doRes.json()
      const promptTokens = data.usage?.prompt_tokens ?? 0
      const completionTokens = data.usage?.completion_tokens ?? 0
      const cost = calculateCost(doModel, promptTokens, completionTokens)

      if (usedToday + cost <= FREE_DAILY_USD_LIMIT) {
        await db.insert(aiUsage).values({ id: uuidv4(), userId: session.user.id, model: doModel, cost })
      }

      const userContent = messages[messages.length - 1]?.content ?? ''
      await db.insert(aiMessages).values({ id: uuidv4(), conversationId: conversationId!, role: 'user', content: userContent, model: selectedModel, tokensIn: promptTokens })
      await db.insert(aiMessages).values({ id: uuidv4(), conversationId: conversationId!, role: 'assistant', content: data.choices?.[0]?.message?.content ?? '', model: doModel, tokensOut: completionTokens })
      await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId!))

      return Response.json({
        id: oaiId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: doModel,
        conversation_id: conversationId,
        choices: [{
          index: 0,
          message: data.choices?.[0]?.message ?? { role: 'assistant', content: '' },
          finish_reason: data.choices?.[0]?.finish_reason ?? 'stop',
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: (promptTokens + completionTokens),
        },
        _cost: cost,
        _usedToday: usedToday + cost,
        _limit: FREE_DAILY_USD_LIMIT,
        _fallback: didFallback,
        _fallbackFrom: didFallback ? selectedModel : undefined,
      })
    }

    // ---- Streaming ----
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

        const userContent = messages[messages.length - 1]?.content ?? ''
        await db.insert(aiMessages).values({ id: uuidv4(), conversationId: conversationId!, role: 'user', content: userContent, model: selectedModel, tokensIn: promptTokens })
        await db.insert(aiMessages).values({ id: uuidv4(), conversationId: conversationId!, role: 'assistant', content: fullContent, model: doModel, tokensOut: completionTokens })
        await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId!))

        const meta = JSON.stringify({
          _meta: true,
          _cost: cost,
          _usedToday: usedToday + cost,
          _limit: FREE_DAILY_USD_LIMIT,
          _fallback: didFallback,
          _fallbackFrom: didFallback ? selectedModel : undefined,
          _model: doModel,
          _conversationId: conversationId,
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
    console.error('[ai:openai:error]', err?.message ?? err)
    return Response.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
