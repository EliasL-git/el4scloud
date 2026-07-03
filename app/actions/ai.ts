'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, aiUsage } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { chatCompletion, FREE_DAILY_USD_LIMIT, AI_MODELS, calculateCost, type ChatMessage } from '@/lib/ai'

export async function sendChatMessage(
  messages: ChatMessage[],
  model?: string,
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [u] = await db
    .select({ verifiedViaHackclub: user.verifiedViaHackclub })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u?.verifiedViaHackclub) {
    throw new Error('Only Hack Club students can access AI features. Link your Hack Club account in Settings.')
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [usageResult] = await db
    .select({ used: sql<number>`COALESCE(SUM("cost"), 0)::real` })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, session.user.id),
        sql`"createdAt" >= ${todayStart.toISOString()}`,
      )
    )

  const usedToday = usageResult?.used ?? 0

  const selectedModel = model ?? 'deepseek-4-flash'
  const modelIndex = AI_MODELS.findIndex((m) => m.id === selectedModel)
  if (modelIndex === -1) {
    throw new Error('Invalid model selected')
  }
  const nextModel = AI_MODELS[modelIndex + 1]?.id

  if (usedToday >= FREE_DAILY_USD_LIMIT) {
    return {
      error: `You've used your $${FREE_DAILY_USD_LIMIT.toFixed(2)} daily budget. Resets at midnight UTC.`,
      usage: { usedToday, limit: FREE_DAILY_USD_LIMIT },
    }
  }

  const systemMessage: ChatMessage = {
    role: 'system',
    content: 'You are a helpful assistant. Be concise, accurate, and helpful.',
  }

  try {
    const response = await chatCompletion({
      model: selectedModel,
      nextModel,
      messages: [systemMessage, ...messages],
    })

    const cost = calculateCost(
      response.model,
      response.usage.promptTokens,
      response.usage.completionTokens,
    )

    if (usedToday + cost > FREE_DAILY_USD_LIMIT) {
      const allowed = FREE_DAILY_USD_LIMIT - usedToday
      return {
        error: `This request costs $${cost.toFixed(6)} but you only have $${allowed.toFixed(4)} remaining ($${FREE_DAILY_USD_LIMIT.toFixed(2)}/day). Try again tomorrow or with a shorter prompt.`,
        usage: { usedToday, limit: FREE_DAILY_USD_LIMIT },
      }
    }

    await db.insert(aiUsage).values({
      id: uuidv4(),
      userId: session.user.id,
      model: response.model,
      cost,
    })

    return {
      model: response.model,
      message: response.choices[0].message,
      usage: {
        usedToday: usedToday + cost,
        limit: FREE_DAILY_USD_LIMIT,
        charged: cost,
      },
      fallback: response.fallback,
      fallbackFrom: selectedModel,
    }
  } catch (err: any) {
    console.error('[ai:sendChatMessage] Error:', err?.message ?? err)
    return { error: err?.message ?? 'An error occurred while processing your request.' }
  }
}

export async function getAiUsage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [u] = await db
    .select({ verifiedViaHackclub: user.verifiedViaHackclub })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u?.verifiedViaHackclub) {
    return { hasAccess: false, usedToday: 0, limit: FREE_DAILY_USD_LIMIT }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [usageResult] = await db
    .select({
      used: sql<number>`COALESCE(SUM("cost"), 0)::real`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, session.user.id),
        sql`"createdAt" >= ${todayStart.toISOString()}`,
      )
    )

  return {
    hasAccess: true,
    usedToday: usageResult?.used ?? 0,
    limit: FREE_DAILY_USD_LIMIT,
    requestCount: usageResult?.count ?? 0,
  }
}

export async function getAiModels() {
  return AI_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    inputPricePer1M: m.inputPricePer1M,
    outputPricePer1M: m.outputPricePer1M,
  }))
}
