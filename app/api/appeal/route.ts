import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, appeals } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json(null)
  }

  const [u] = await db
    .select({ appealable: user.appealable })
    .from(user)
    .where(eq(user.id, session.user.id))

  const appealable = u?.appealable ?? true

  const [existing] = await db
    .select({ status: appeals.status, adminNote: appeals.adminNote })
    .from(appeals)
    .where(eq(appeals.userId, session.user.id))
    .orderBy(appeals.createdAt)
    .limit(1)

  if (existing) {
    return Response.json({ ...existing, appealable })
  }

  return Response.json({ appealable })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [u] = await db
    .select({ banned: user.banned, suspensionReason: user.suspensionReason, appealable: user.appealable })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u?.banned || !u?.suspensionReason) {
    return Response.json({ error: 'Account is not suspended' }, { status: 400 })
  }

  if (!u.appealable) {
    return Response.json({ error: 'Appeals are not allowed for this suspension' }, { status: 403 })
  }

  const [existing] = await db
    .select({ id: appeals.id })
    .from(appeals)
    .where(eq(appeals.userId, session.user.id))

  if (existing) {
    return Response.json({ error: 'Appeal already submitted' }, { status: 400 })
  }

  const { reason } = await req.json() as { reason: string }
  if (!reason?.trim()) {
    return Response.json({ error: 'Reason is required' }, { status: 400 })
  }

  await db.insert(appeals).values({
    id: uuidv4(),
    userId: session.user.id,
    reason: reason.trim(),
  })

  return Response.json({ ok: true })
}
