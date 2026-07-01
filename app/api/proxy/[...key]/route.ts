import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiKeys, files } from '@/lib/db/schema'

import { s3, S3_BUCKET } from '@/lib/s3'
import { eq, and, desc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import sharp from 'sharp'
import { verify } from '@/lib/hash'

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

function getHostUrl(hdrs: Headers) {
  if (process.env.HOST_URL) {
    let hostUrl = process.env.HOST_URL
    if (!hostUrl.startsWith('http://') && !hostUrl.startsWith('https://')) {
      hostUrl = `https://${hostUrl}`
    }
    return hostUrl
  }
  const host = hdrs.get('host') || 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  return `${proto}://${host}`
}

export async function GET(
  req: NextRequest,
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

  let [file] = await db
    .select()
    .from(files)
    .where(eq(files.key, objectKey))

  if (!file && keyParts.length === 2) {
    const [ownerId, ...nameParts] = keyParts
    const fileName = nameParts.join('/')
    const decodedName = decodeURIComponent(fileName)
    ;[file] = await db
      .select()
      .from(files)
      .where(and(eq(files.userId, ownerId), eq(files.originalName, decodedName)))
      .orderBy(desc(files.createdAt))
  }

  if (!file) {
    return new Response('Not found', { status: 404 })
  }

  if (!file.isPublic && file.userId !== userId) {
    return new Response('Forbidden', { status: 403 })
  }

  const hostUrl = getHostUrl(hdrs)
  const reportUrl = `${hostUrl}/takedown`

  const raw = req.nextUrl.searchParams.has('raw')

  if (file.passwordHash) {
    const givenPassword = req.nextUrl.searchParams.get('password')
    if (!givenPassword) {
      if (raw) {
        return new Response('Password required', { status: 401 })
      }
      const filePath = objectKey.split('/').map(encodeURIComponent).join('/')
      return Response.redirect(new URL(`/file/${filePath}`, req.url))
    }
    const valid = await verify(givenPassword, file.passwordHash)
    if (!valid) {
      if (raw) {
        return new Response('Incorrect password', { status: 401 })
      }
      const filePath = objectKey.split('/').map(encodeURIComponent).join('/')
      return Response.redirect(new URL(`/file/${filePath}?error=incorrect`, req.url))
    }
  }

  if (!mimeTypeFromExt(objectKey).startsWith('image/') && !raw) {
    const passwordParam = file.passwordHash && req.nextUrl.searchParams.get('password')
      ? `?password=${req.nextUrl.searchParams.get('password')}`
      : ''
    const filePath = objectKey.split('/').map(encodeURIComponent).join('/')
    return Response.redirect(new URL(`/file/${filePath}${passwordParam}`, req.url))
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

  if (mimeType.startsWith('image/')) {
    const overlaySvg = Buffer.from(`<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <style>
          .bg { fill: rgba(0,0,0,0.7); }
          .title { fill: #fff; font-family: sans-serif; font-size: 16px; font-weight: bold; text-anchor: middle; }
          .sub { fill: #ccc; font-family: sans-serif; font-size: 11px; text-anchor: middle; }
          .link { fill: #6af; font-family: sans-serif; font-size: 12px; text-anchor: middle; }
        </style>
        <rect class="bg" x="0" y="0" width="100%" height="86" rx="0" />
        <text class="title" x="50%" y="24">This file is hosted at ${hostUrl}</text>
        <text class="link" x="50%" y="48">Is it violating our TOS? or a law? Report it here:</text>
        <text class="sub" x="50%" y="68">${reportUrl}</text>
      </svg>`)

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
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `inline; filename="${file.originalName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-File-Host': hostUrl,
      'X-File-Report': reportUrl,
    },
  })
}

function mimeTypeFromExt(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) return 'application/octet-stream'
  const map: Record<string, string> = {
    zip: 'application/zip',
    gz: 'application/gzip',
    tar: 'application/x-tar',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    txt: 'text/plain',
    json: 'application/json',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
  }
  return map[ext] ?? 'application/octet-stream'
}
