import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { files, shareLinks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { s3, S3_BUCKET } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))

  if (!link) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
  }

  if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
    return NextResponse.json({ error: 'Share link has reached its download limit' }, { status: 410 })
  }

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, link.fileId))

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  await db
    .update(shareLinks)
    .set({ downloadCount: link.downloadCount + 1 })
    .where(eq(shareLinks.id, link.id))

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: file.key,
  })
  const s3Response = await s3.send(command)

  if (!s3Response.Body) {
    return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
  }

  const body = s3Response.Body as ReadableStream
  const contentType = file.mimeType || 'application/octet-stream'

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${file.originalName}"`,
      'Content-Length': String(file.size),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
