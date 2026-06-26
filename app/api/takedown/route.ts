import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { takedownRequests, files } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fileUrl, reason, contactEmail, details } = body

    if (!fileUrl || !reason || !contactEmail) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    if (!contactEmail.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    // Try to resolve the fileId from the URL
    let fileId: string | null = null
    try {
      const url = new URL(fileUrl)
      const keyMatch = url.pathname.match(/^\/api\/proxy\/(.+)$/)
      if (keyMatch) {
        const proxyKey = keyMatch[1]
        const [file] = await db
          .select()
          .from(files)
          .where(and(eq(files.publicUrl, proxyKey), eq(files.isPublic, true)))
          .limit(1)
        if (file) {
          fileId = file.id
        }
      }
    } catch {
      // URL parsing failed, that's ok — we'll still create the request without fileId
    }

    // Create the takedown request
    await db.insert(takedownRequests).values({
      id: uuidv4(),
      fileUrl,
      reason,
      contactEmail,
      details: details ?? null,
      fileId,
      status: 'pending',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[takedown] Error:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
