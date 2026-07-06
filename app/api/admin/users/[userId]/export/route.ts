import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, files } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { s3, S3_BUCKET } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createZip } from '@/lib/zip'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [admin] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
  if (admin?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params

  const [u] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userFiles = await db
    .select({ name: files.name, key: files.key, originalName: files.originalName })
    .from(files)
    .where(eq(files.userId, userId))

  const entries: { name: string; data: Buffer }[] = []

  entries.push({
    name: 'account.json',
    data: Buffer.from(JSON.stringify({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      role: u.role,
      banned: u.banned,
      suspensionReason: u.suspensionReason,
      suspensionType: u.suspensionType,
      storageLimit: u.storageLimit,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }, null, 2), 'utf8'),
  })

  for (const f of userFiles) {
    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: f.key,
      }))
      const body = await response.Body?.transformToByteArray()
      if (body) {
        entries.push({
          name: `files/${f.originalName || f.name}`,
          data: Buffer.from(body),
        })
      }
    } catch (err) {
      console.error(`[export] Failed to fetch file ${f.key}:`, err)
    }
  }

  const zip = createZip(entries)

  return new NextResponse(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${u.email}-data.zip"`,
    },
  })
}
