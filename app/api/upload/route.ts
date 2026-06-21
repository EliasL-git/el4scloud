import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiKeys, files } from '@/lib/db/schema'
import { s3, S3_BUCKET } from '@/lib/s3'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export async function POST(req: Request) {
  const hdrs = await headers()

  // Try session auth first
  let userId: string | null = null
  const session = await auth.api.getSession({ headers: hdrs })
  if (session?.user) {
    userId = session.user.id
  }

  // Fall back to API key auth
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
        // Update lastUsedAt
        await db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, keyRecord.id))
      }
    }
  }

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { fileName, mimeType, size, isPublic = false } = body

  if (!fileName || !mimeType || !size) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const fileId = uuidv4()
  const ext = fileName.split('.').pop()
  const key = `${userId}/${fileId}${ext ? `.${ext}` : ''}`

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: size,
    Metadata: {
      userId,
      originalName: fileName,
    },
  })

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })

  await db.insert(files).values({
    id: fileId,
    userId,
    name: fileName,
    originalName: fileName,
    key,
    size,
    mimeType,
    isPublic,
  })

  return Response.json({
    fileId,
    key,
    presignedUrl,
  })
}
