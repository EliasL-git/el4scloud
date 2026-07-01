import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { files, shareLinks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { s3, S3_BUCKET } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { verify } from '@/lib/hash'

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

  if (link.passwordHash) {
    const givenPassword = req.nextUrl.searchParams.get('password')
    if (!givenPassword) {
      return new NextResponse(
        `<html><body style="display:flex;align-items:center;justify-content:center;min-height:100svh;margin:0;background:#09090b;color:#e4e4e7;font-family:sans-serif">
          <form method="GET" style="background:#18181b;padding:2rem;border-radius:8px;border:1px solid #27272a;text-align:center;max-width:360px;width:100%">
            <div style="font-size:1.25rem;font-weight:600;margin-bottom:0.25rem">Password required</div>
            <p style="font-size:0.875rem;color:#a1a1aa;margin-bottom:1.5rem">This share link is password-protected.</p>
            <input type="hidden" name="token" value="${token}" />
            <input type="password" name="password" placeholder="Enter password" style="width:100%;padding:0.5rem 0.75rem;border-radius:6px;border:1px solid #27272a;background:#09090b;color:#e4e4e7;font-size:0.875rem;margin-bottom:0.75rem;box-sizing:border-box" autofocus />
            <button type="submit" style="width:100%;padding:0.5rem;border-radius:6px;border:none;background:#fafafa;color:#09090b;font-size:0.875rem;font-weight:500;cursor:pointer">Unlock</button>
          </form>
        </body></html>`,
        { status: 401, headers: { 'Content-Type': 'text/html' } }
      )
    }
    const valid = await verify(givenPassword, link.passwordHash)
    if (!valid) {
      return new NextResponse(
        `<html><body style="display:flex;align-items:center;justify-content:center;min-height:100svh;margin:0;background:#09090b;color:#e4e4e7;font-family:sans-serif">
          <form method="GET" style="background:#18181b;padding:2rem;border-radius:8px;border:1px solid #27272a;text-align:center;max-width:360px;width:100%">
            <div style="font-size:1.25rem;font-weight:600;margin-bottom:0.25rem">Password required</div>
            <p style="font-size:0.875rem;color:#ef4444;margin-bottom:1.5rem">Incorrect password. Try again.</p>
            <input type="hidden" name="token" value="${token}" />
            <input type="password" name="password" placeholder="Enter password" style="width:100%;padding:0.5rem 0.75rem;border-radius:6px;border:1px solid #27272a;background:#09090b;color:#e4e4e7;font-size:0.875rem;margin-bottom:0.75rem;box-sizing:border-box" autofocus />
            <button type="submit" style="width:100%;padding:0.5rem;border-radius:6px;border:none;background:#fafafa;color:#09090b;font-size:0.875rem;font-weight:500;cursor:pointer">Unlock</button>
          </form>
        </body></html>`,
        { status: 401, headers: { 'Content-Type': 'text/html' } }
      )
    }
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
