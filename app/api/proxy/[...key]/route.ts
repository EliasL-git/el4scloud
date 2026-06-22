import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiKeys, files } from '@/lib/db/schema'
import { ensureCredits, creditCostForTraffic } from '@/lib/credits'
import { s3, S3_BUCKET } from '@/lib/s3'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: keyParts } = await params
  const objectKey = keyParts.join('/')

  const hdrs = await headers()
  let userId: string | null = null

  const session = await auth.api.getSession({ headers: hdrs })
  if (session?.user) {
    userId = session.user.id
  }

  if (!userId) {
    const authHeader = hdrs.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const rawKey = authHeader.slice(7)
      const keyHash = hashKey(rawKey)
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
      if (keyRecord) {
        userId = keyRecord.userId
      }
    }
  }

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.key, objectKey))

  if (!file) {
    return new Response('Not found', { status: 404 })
  }

  if (!file.isPublic && file.userId !== userId) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    await ensureCredits(file.userId, creditCostForTraffic(file.size))
  } catch {
    return new Response('Insufficient credits', { status: 429 })
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: objectKey,
  })

  const s3Response = await s3.send(command)

  const body = s3Response.Body
  if (!body) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(body.transformToWebStream(), {
    headers: {
      'Content-Type': s3Response.ContentType ?? file.mimeType,
      'Content-Length': String(s3Response.ContentLength ?? file.size),
      'Content-Disposition': `inline; filename="${file.originalName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
