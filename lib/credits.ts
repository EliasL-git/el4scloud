import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { CREDIT_COSTS, FREE_CREDITS, CREDIT_PERIOD_DAYS, CREDIT_RATE_PER_KB } from '@/lib/credit-constants'

export function creditCostForTraffic(sizeBytes: number): number {
  return Math.ceil((sizeBytes / 1024) * CREDIT_RATE_PER_KB)
}

async function getCreditsRow(userId: string) {
  const [u] = await db
    .select({
      creditsRemaining: user.creditsRemaining,
      creditsPeriodStart: user.creditsPeriodStart,
    })
    .from(user)
    .where(eq(user.id, userId))
  if (!u) throw new Error('User not found')
  return u
}

export async function ensureCredits(userId: string, cost: number): Promise<void> {
  const u = await getCreditsRow(userId)

  const now = new Date()
  const remaining = u.creditsRemaining ?? FREE_CREDITS
  const periodStart = new Date(u.creditsPeriodStart)
  const daysSinceReset = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceReset >= CREDIT_PERIOD_DAYS) {
    await db
      .update(user)
      .set({ creditsRemaining: FREE_CREDITS - cost, creditsPeriodStart: now })
      .where(eq(user.id, userId))
    return
  }

  if (remaining < cost) {
    throw new Error(
      `You need ${cost} credits but only have ${remaining} remaining. Credits reset every ${CREDIT_PERIOD_DAYS} days.`,
    )
  }

  await db
    .update(user)
    .set({ creditsRemaining: remaining - cost })
    .where(eq(user.id, userId))
}

export async function getCredits(userId: string): Promise<{ remaining: number; periodStart: Date }> {
  const u = await getCreditsRow(userId)

  const now = new Date()
  const remaining = u.creditsRemaining ?? FREE_CREDITS
  const periodStart = new Date(u.creditsPeriodStart)
  const daysSinceReset = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceReset >= CREDIT_PERIOD_DAYS) {
    return { remaining: FREE_CREDITS, periodStart: now }
  }

  return { remaining, periodStart }
}
