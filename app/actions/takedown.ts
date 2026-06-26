'use server'

import { db } from '@/lib/db'
import { files, takedownRequests } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

const VALID_REASONS = [
  "I don't like it.",
  'This is my content and they are uploading it without my permission',
  'This is illegal in the EU',
  'This is illegal in my country',
  'This contains malware or malicious code',
  'This contains hate speech or harassment',
  'This is sexually explicit and I am a minor in it',
  'Other legal reason',
]

export async function submitTakedownRequest(data: {
  fileUrl: string
  reporterName: string
  reporterEmail: string
  reason: string
  details?: string
}) {
  if (!data.fileUrl?.trim()) return { error: 'File URL is required' }
  if (!data.reporterEmail?.trim()) return { error: 'Your email is required' }
  if (!data.reason?.trim()) return { error: 'Please select a reason' }
  if (!VALID_REASONS.includes(data.reason.trim())) return { error: 'Invalid reason selected' }

  // Try to find the file from the URL
  let fileId: string | null = null
  try {
    const url = new URL(data.fileUrl)
    const proxyMatch = url.pathname.match(/^\/api\/proxy\/(.+)$/)
    if (proxyMatch) {
      const key = proxyMatch[1]
      const [file] = await db
        .select({ id: files.id })
        .from(files)
        .where(eq(files.key, key))
      if (file) fileId = file.id
    }
  } catch {
    // Invalid URL, that's okay — we can still log the request without a file match
  }

  await db.insert(takedownRequests).values({
    id: uuidv4(),
    fileId: fileId,
    fileUrl: data.fileUrl.trim(),
    reporterName: data.reporterName.trim() || null,
    reporterEmail: data.reporterEmail.trim(),
    reason: data.reason.trim(),
    details: data.details || null,
    status: 'pending',
  })

  return { ok: true }
}
