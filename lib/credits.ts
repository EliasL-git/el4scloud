import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const CREDIT_COSTS = {
  UPLOAD: 0.5,
  DOWNLOAD: 0.1,
  DELETE: 0.1,
  TOGGLE_VISIBILITY: 0.1,
  CREATE_API_KEY: 0.2,
} as const

export const FREE_CREDITS = 100
export const CREDIT_PERIOD_DAYS = 30

export async function ensureCredits(userId: string, cost: number): Promise<void> {
  const [u] = await db
    .select({
      creditsRemaining: user.creditsRemaining,
      creditsPeriodStart: user.creditsPeriodStart,
    })
    .from(user)
    .where(eq(user.id, userId))

  if (!u) throw new Error('User not found')

  const now = new Date()
  const periodStart = new Date(u.creditsPeriodStart)
  const daysSinceReset = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceReset >= CREDIT_PERIOD_DAYS) {
    await db
      .update(user)
      .set({ creditsRemaining: FREE_CREDITS - cost, creditsPeriodStart: now })
      .where(eq(user.id, userId))
    return
  }

  if (u.creditsRemaining < cost) {
    throw new Error(
      `You need ${cost} credits but only have ${u.creditsRemaining} remaining. Credits reset every ${CREDIT_PERIOD_DAYS} days.`,
    )
  }

  await db
    .update(user)
    .set({ creditsRemaining: u.creditsRemaining - cost })
    .where(eq(user.id, userId))
}

export async function getCredits(userId: string): Promise<{ remaining: number; periodStart: Date }> {
  const [u] = await db
    .select({
      creditsRemaining: user.creditsRemaining,
      creditsPeriodStart: user.creditsPeriodStart,
    })
    .from(user)
    .where(eq(user.id, userId))

  if (!u) throw new Error('User not found')

  const now = new Date()
  const periodStart = new Date(u.creditsPeriodStart)
  const daysSinceReset = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceReset >= CREDIT_PERIOD_DAYS) {
    return { remaining: FREE_CREDITS, periodStart: now }
  }

  return { remaining: u.creditsRemaining, periodStart }
}
