import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { files } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { s3, S3_BUCKET } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { verify } from '@/lib/hash'
import { auth } from '@/lib/auth'
import { CopyLinkButton } from './copy-button'
import { listZipContents } from '@/lib/zip-listing'

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

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

async function getPreviewText(key: string, maxBytes = 65536): Promise<string | null> {
  try {
    const cmd = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Range: `bytes=0-${maxBytes - 1}`,
    })
    const res = await s3.send(cmd)
    if (!res.Body) return null
    const buf = Buffer.from(await res.Body.transformToByteArray())
    return buf.toString('utf-8')
  } catch {
    return null
  }
}

const TEXT_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript', 'application/yaml']

export default async function FilePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string[] }>
  searchParams: Promise<{ password?: string; error?: string }>
}) {
  const { key: keyParts } = await params
  const objectKey = keyParts.join('/')
  const sp = await searchParams
  const hdrs = await headers()
  const hostUrl = getHostUrl(hdrs)
  const reportUrl = `${hostUrl}/takedown`

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
    redirect('/')
  }

  let userId: string | null = null
  const session = await auth.api.getSession({ headers: hdrs })
  if (session?.user) userId = session.user.id

  if (!file.isPublic && file.userId !== userId) {
    redirect('/')
  }

  const proxyUrl = `${hostUrl}/api/proxy/${file.userId}/${encodeURIComponent(file.originalName)}`
  const rawUrl = `${proxyUrl}?raw${file.passwordHash && sp.password ? `&password=${sp.password}` : ''}`

  if (file.passwordHash) {
    const givenPassword = sp.password
    const errorParam = sp.error
    if (!givenPassword) {
      if (errorParam === 'incorrect') {
        return <PasswordGate hostUrl={hostUrl} reportUrl={reportUrl} fileName={file.originalName} error="Incorrect password" />
      }
      return <PasswordGate hostUrl={hostUrl} reportUrl={reportUrl} fileName={file.originalName} />
    }
    const valid = await verify(givenPassword, file.passwordHash)
    if (!valid) {
      return <PasswordGate hostUrl={hostUrl} reportUrl={reportUrl} fileName={file.originalName} error="Incorrect password" />
    }
  }

  const isText = TEXT_PREFIXES.some((p) => file.mimeType.startsWith(p) || file.mimeType.includes(p))
  const isImage = file.mimeType.startsWith('image/')
  const isVideo = file.mimeType.startsWith('video/')
  const isZip = file.mimeType.includes('zip') || file.originalName.endsWith('.zip')

  let previewText: string | null = null
  if (isText) {
    previewText = await getPreviewText(objectKey)
  }

  let zipEntries: Awaited<ReturnType<typeof listZipContents>> | null = null
  if (isZip) {
    try {
      zipEntries = await listZipContents(objectKey)
    } catch {
      // silently fail — zip listing is a best-effort preview
    }
  }

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <div
            className="size-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            <svg className="size-3.5" style={{ color: 'var(--brand-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">Hobbycloud</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <FileIcon mimeType={file.mimeType} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight truncate">{file.originalName}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatSize(file.size)} &middot; {file.mimeType}
                </p>
              </div>
            </div>
          </div>

          {isImage && (
            <div className="rounded-lg border border-border overflow-hidden mb-6 bg-secondary/30">
              <img
                src={rawUrl}
                alt={file.originalName}
                className="max-w-full max-h-[70vh] mx-auto object-contain"
              />
            </div>
          )}

          {isVideo && (
            <div className="rounded-lg border border-border overflow-hidden mb-6 bg-black">
              <video src={rawUrl} controls className="max-w-full max-h-[70vh] mx-auto">
                Your browser does not support video playback.
              </video>
            </div>
          )}

          {previewText !== null && (
            <div className="rounded-lg border border-border overflow-hidden mb-6">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                <span className="text-xs text-muted-foreground font-mono">Preview</span>
                <span className="text-[10px] text-muted-foreground">
                  {file.size > 65536 ? 'Showing first 64 KB' : formatSize(file.size)}
                </span>
              </div>
              <pre className="text-sm p-4 overflow-auto max-h-96 whitespace-pre-wrap break-all font-mono text-foreground/80">
                {previewText}
              </pre>
            </div>
          )}

          {zipEntries !== null && (
            <div className="rounded-lg border border-border overflow-hidden mb-6">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                <span className="text-xs text-muted-foreground font-mono">Archive contents</span>
                <span className="text-[10px] text-muted-foreground">{zipEntries.length} file{zipEntries.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {zipEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Empty archive</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left font-medium px-4 py-2 w-8">#</th>
                        <th className="text-left font-medium px-4 py-2">Name</th>
                        <th className="text-right font-medium px-4 py-2 whitespace-nowrap">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zipEntries.map((entry, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-secondary/30">
                          <td className="px-4 py-1.5 text-xs text-muted-foreground w-8 align-top">{i + 1}</td>
                          <td className="px-4 py-1.5 font-mono text-xs break-all">
                            {entry.name.endsWith('/') ? (
                              <span className="text-muted-foreground">{entry.name}</span>
                            ) : (
                              entry.name
                            )}
                          </td>
                          <td className="px-4 py-1.5 text-xs text-muted-foreground text-right whitespace-nowrap align-top">
                            {formatSize(entry.uncompressedSize)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={rawUrl}
              download
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              <DownloadIcon />
              Download file
            </a>
            <CopyLinkButton url={proxyUrl} />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            This file is hosted on{' '}
            <a href={hostUrl} className="underline underline-offset-2 hover:text-foreground">{hostUrl}</a>
            .{' '}
            See our{' '}
            <a href="/legal" className="underline underline-offset-2 hover:text-foreground">Terms</a>
            {' '}and{' '}
            <a href="/security" className="underline underline-offset-2 hover:text-foreground">Security</a>
            {' '}policies. Is it violating our TOS or a law?{' '}
            <a href={reportUrl} className="underline underline-offset-2 hover:text-foreground font-medium">Report it here</a>.
          </p>
        </div>
      </main>
    </div>
  )
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const cls = 'size-5 text-muted-foreground'
  if (mimeType.startsWith('image/'))
    return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
  if (mimeType.startsWith('video/'))
    return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 0 0 2.25-2.25V7.5a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip'))
    return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
  return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
}

function DownloadIcon() {
  return <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
}

function PasswordGate({
  hostUrl,
  reportUrl,
  fileName,
  error,
}: {
  hostUrl: string
  reportUrl: string
  fileName: string
  error?: string
}) {
  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <div className="size-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--brand)' }}>
            <svg className="size-3.5" style={{ color: 'var(--brand-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">Hobbycloud</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 sm:p-8 text-center">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <svg className="size-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight mb-1">Password required</h1>
          <p className="text-sm text-muted-foreground mb-1">{fileName}</p>
          {error && <p className="text-sm text-destructive mb-4">{error}</p>}
          <form className="flex flex-col gap-3">
            <input
              type="password"
              name="password"
              placeholder="Enter file password"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              Unlock
            </button>
          </form>
        </div>
      </main>
      <footer className="py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Hosted on{' '}
          <a href={hostUrl} className="underline underline-offset-2 hover:text-foreground">{hostUrl}</a>
          .{' '}
          <a href={reportUrl} className="underline underline-offset-2 hover:text-foreground">Report</a>
        </p>
      </footer>
    </div>
  )
}
