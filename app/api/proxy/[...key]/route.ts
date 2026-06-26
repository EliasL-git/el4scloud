import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiKeys, files } from '@/lib/db/schema'

import { s3, S3_BUCKET } from '@/lib/s3'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import sharp from 'sharp'

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

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: objectKey,
  })

  const s3Response = await s3.send(command)

  const body = s3Response.Body
  if (!body) {
    return new Response('Not found', { status: 404 })
  }

  const buffer = Buffer.from(await body.transformToByteArray())
  const mimeType = s3Response.ContentType ?? file.mimeType

  // Hotlink detection: only apply overlay to images being hotlinked from external domains
  const referer = hdrs.get('referer')
  const host = hdrs.get('host') ?? ''
  const appDomain = host.split(':')[0] // strip port

  if (referer && mimeType.startsWith('image/')) {
    try {
      const refererUrl = new URL(referer)
      const refererHost = refererUrl.hostname

      // If the referer is a different domain and not one of our own, overlay a warning
      if (refererHost && refererHost !== appDomain && !refererHost.endsWith(`.${appDomain}`) && !refererHost.endsWith('.el4s.cloud')) {
        const overlaySvg = Buffer.from(`\n          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">\n            <style>\n              .bg { fill: rgba(0,0,0,0.7); }\n              .title { fill: #fff; font-family: sans-serif; font-size: 16px; font-weight: bold; text-anchor: middle; }\n              .sub { fill: #aaa; font-family: sans-serif; font-size: 13px; text-anchor: middle; }\n              .link { fill: #6af; font-family: sans-serif; font-size: 12px; text-anchor: middle; }\n            </style>\n            <rect class="bg" x="0" y="0" width="100%" height="72" rx="0" />\n            <text class="title" x="50%" y="28">Hosted on cloud.el4s.dev</text>\n            <text class="link" x="50%" y="52">Is this file illegal? Report at cloud.el4s.dev/takedown</text>\n          </svg>\n        `)

        const processed = await sharp(buffer)
          .resize({ width: Math.min(1200, (await sharp(buffer).metadata()).width ?? 1200) })
          .composite([
            {
              input: overlaySvg,
              top: 0,
              left: 0,
              gravity: 'north',
            },
          ])
          .toBuffer()

        return new Response(processed, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(processed.length),
            'Cache-Control': 'no-cache',
          },
        })
      }
    } catch {
      // If referer parsing fails, just serve the original
    }
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `inline; filename="${file.originalName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
