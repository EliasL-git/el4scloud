import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { webhooks } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { generateWebhookSecret, validateWebhookUrl, parseEvents } from '@/lib/webhooks/validation'
import { fireWebhook } from '@/lib/webhooks/fire'
import { NextResponse } from 'next/server'
import { assertNotSuspended } from '@/lib/suspension'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  await assertNotSuspended(session.user.id)
  return session.user.id
}

export async function GET() {
  const userId = await getUserId()

  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      active: webhooks.active,
      createdAt: webhooks.createdAt,
      secretPrefix: sql`LEFT(${webhooks.secret}, 8)`,
    })
    .from(webhooks)
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhooks.createdAt))

  return NextResponse.json({ webhooks: rows })
}

export async function POST(req: Request) {
  const userId = await getUserId()

  const body = await req.json().catch(() => null)
  if (!body || typeof body.url !== 'string' || !Array.isArray(body.events)) {
    return NextResponse.json({ error: 'url and events[] are required' }, { status: 400 })
  }

  try {
    validateWebhookUrl(body.url)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  const events = parseEvents(body.events)
  if (events.length === 0) {
    return NextResponse.json({ error: 'No valid events selected' }, { status: 400 })
  }

  const secret = generateWebhookSecret()

  const id = uuidv4()
  await db.insert(webhooks).values({
    id,
    userId,
    url: body.url.trim(),
    secret,
    events: JSON.stringify(events),
    active: true,
  })

  const webhook = await db.select().from(webhooks).where(eq(webhooks.id, id)).then((r) => r[0])
  if (webhook) {
    await fireWebhook(userId, 'webhook.test', { webhookId: id }).catch(() => undefined)
  }

  return NextResponse.json(
    {
      id,
      url: webhook.url,
      events,
      active: webhook.active,
      createdAt: webhook.createdAt,
      secretPrefix: secret.slice(0, 8),
    },
    { status: 201 }
  )
}
