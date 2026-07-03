import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { webhooks, webhookDeliveries } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function GET(req: Request) {
  const userId = await getUserId()

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 100)

  const userHooks = await db.select({ id: webhooks.id }).from(webhooks).where(eq(webhooks.userId, userId))
  const hookIds = userHooks.map((h) => h.id)

  if (hookIds.length === 0) {
    return NextResponse.json({ deliveries: [] })
  }

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(sql`${webhookDeliveries.webhookId} IN (${hookIds.map((id) => `'${id}'`).join(',')})`)
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)

  return NextResponse.json({ deliveries })
}
