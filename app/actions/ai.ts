'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, aiUsage, aiConversations, aiMessages } from '@/lib/db/schema'
import { eq, and, sql, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { chatCompletion, FREE_DAILY_USD_LIMIT, AI_MODELS, calculateCost, type ChatMessage } from '@/lib/ai'
import { fireWebhook } from '@/lib/webhooks/fire'

export async function sendChatMessage(
  messages: ChatMessage[],
  model?: string,
  conversationId?: string,
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

  let conversation = conversationId
  if (!conversation) {
    const created = await createConversation()
    conversation = created.id
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
    await fireWebhook(session.user.id, 'ai.daily_limit_exceeded', { usedToday, limit: FREE_DAILY_USD_LIMIT }).catch(() => undefined)
    return {
      error: `You've used your $${FREE_DAILY_USD_LIMIT.toFixed(2)} daily budget. Resets at midnight UTC.`,
      usage: { usedToday, limit: FREE_DAILY_USD_LIMIT },
      conversationId: conversation,
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
        conversationId: conversation,
      }
    }

    const LIMIT_WARNING_THRESHOLD = 0.8
    const projectedTotal = usedToday + cost
    if (usedToday < FREE_DAILY_USD_LIMIT * LIMIT_WARNING_THRESHOLD && projectedTotal >= FREE_DAILY_USD_LIMIT * LIMIT_WARNING_THRESHOLD) {
      await fireWebhook(session.user.id, 'ai.daily_limit_warning', { usedToday: projectedTotal, limit: FREE_DAILY_USD_LIMIT }).catch(() => undefined)
    }

    await db.insert(aiUsage).values({
      id: uuidv4(),
      userId: session.user.id,
      model: response.model,
      cost,
    })

    const userContent = messages[messages.length - 1]?.content ?? ''
    await db.insert(aiMessages).values({
      id: uuidv4(),
      conversationId: conversation,
      role: 'user',
      content: userContent,
      model: selectedModel,
      tokensIn: response.usage.promptTokens,
    })
    await db.insert(aiMessages).values({
      id: uuidv4(),
      conversationId: conversation,
      role: 'assistant',
      content: response.choices[0].message.content,
      model: response.model,
      tokensOut: response.usage.completionTokens,
    })
    await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversation))

    return {
      model: response.model,
      message: response.choices[0].message,
      conversationId: conversation,
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
    return { error: err?.message ?? 'An error occurred while processing your request.', conversationId: conversation }
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

export async function createConversation(title?: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const id = uuidv4()
  await db.insert(aiConversations).values({
    id,
    userId: session.user.id,
    title: title?.trim() || 'New chat',
  })

  return { id }
}

export async function getConversations() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const conversations = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      createdAt: aiConversations.createdAt,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.userId, session.user.id))
    .orderBy(desc(aiConversations.updatedAt))

  const counts = await db
    .select({
      conversationId: aiMessages.conversationId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(aiMessages)
    .where(
      sql`${aiMessages.conversationId} IN (${conversations.map((c) => `'${c.id}'`).join(',')})`
    )
    .groupBy(aiMessages.conversationId)

  const countMap = new Map(counts.map((c) => [c.conversationId, c.count]))

  return conversations.map((c) => ({
    ...c,
    messageCount: countMap.get(c.id) ?? 0,
  }))
}

export async function getConversation(conversationId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, session.user.id)))

  if (!conversation) throw new Error('Conversation not found')

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt)

  return { ...conversation, messages }
}

export async function renameConversation(conversationId: string, title: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, session.user.id)))

  if (!conversation) throw new Error('Conversation not found')

  await db
    .update(aiConversations)
    .set({ title: title.trim() || 'New chat', updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId))

  return { ok: true }
}

export async function deleteConversation(conversationId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  await db.delete(aiConversations).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, session.user.id)))

  return { ok: true }
}

export async function saveAiMessage(conversationId: string, role: string, content: string, model?: string, tokensIn?: number, tokensOut?: number) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, session.user.id)))

  if (!conversation) throw new Error('Conversation not found')

  await db.insert(aiMessages).values({
    id: uuidv4(),
    conversationId,
    role,
    content,
    model,
    tokensIn,
    tokensOut,
  })

  await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId))

  return { ok: true }
}

export async function getAdminAiUsage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [admin] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id))
  if (admin?.role !== 'admin') throw new Error('Forbidden')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const rows = await db.execute<{
    userId: string
    name: string
    email: string
    requests: number
    spent: number
  }>(sql`
    SELECT
      u.id AS "userId",
      u.name,
      u.email,
      COUNT(a.id)::int AS "requests",
      COALESCE(SUM(a.cost), 0)::real AS "spent"
    FROM "user" u
    LEFT JOIN "ai_usage" a ON a."userId" = u.id AND a."createdAt" >= ${todayStart.toISOString()}
    WHERE u."verifiedViaHackclub" = TRUE
    GROUP BY u.id, u.name, u.email
    ORDER BY "spent" DESC
  `)

  return rows.rows ?? []
}
