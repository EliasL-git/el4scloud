import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiKeys, files, user } from '@/lib/db/schema'
import { s3, S3_BUCKET } from '@/lib/s3'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { checkFile } from '@/lib/file-scan'
import { recordWarning } from '@/lib/warnings'
import { fireWebhook } from '@/lib/webhooks/fire'
import { checkUploadVelocity, checkStorageAbuse } from '@/lib/fraud-detection'

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

const UPLOAD_RATE_LIMIT = 10
const UPLOAD_RATE_WINDOW_MS = 60_000
const uploadRateMap = new Map<string, number[]>()

function checkUploadRateLimit(userId: string): number | null {
  const now = Date.now()
  const timestamps = uploadRateMap.get(userId) ?? []
  const recent = timestamps.filter((t) => now - t < UPLOAD_RATE_WINDOW_MS)
  if (recent.length >= UPLOAD_RATE_LIMIT) {
    return Math.max(0, UPLOAD_RATE_WINDOW_MS - (now - recent[0]))
  }
  recent.push(now)
  uploadRateMap.set(userId, recent)
  return null
}

export async function POST(req: Request) {
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

  const [currentUser] = await db
    .select({ banned: user.banned, suspensionType: user.suspensionType, storageLimit: user.storageLimit })
    .from(user)
    .where(eq(user.id, userId))

  if (currentUser?.banned) {
    if (currentUser?.suspensionType === 'warned') {
      return Response.json({
        error: 'Your account has been warned due to a Terms of Service violation. Please reactivate your account before uploading.',
        warned: true,
      }, { status: 403 })
    }
    if (currentUser?.suspensionType === 'suspended') {
      return Response.json({
        error: 'Your account has been suspended for repeated violations of our terms of service.',
        suspended: true,
      }, { status: 403 })
    }
  }

  const retryAfter = checkUploadRateLimit(userId)
  if (retryAfter !== null) {
    return Response.json({
      error: 'Too many uploads. Please wait before uploading again.',
      retryAfter,
    }, { status: 429 })
  }

  if (!currentUser || currentUser.storageLimit === 0) {
    return Response.json({
      error: 'You need to apply for storage before uploading files. Visit your dashboard to submit a storage request.',
    }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const fileFields = formData.getAll('file')
  if (fileFields.length === 0 || fileFields.every((f) => !(f instanceof File))) {
    return Response.json({ error: 'At least one file is required' }, { status: 400 })
  }

  const isPublic = formData.get('isPublic') === 'true'
  const results: Array<Record<string, unknown>> = []
  let hasError = false

  for (const field of fileFields) {
    if (!(field instanceof File)) continue

    const file = field as File
    const name = file.name
    const size = file.size

    if (size === 0) {
      results.push({ error: `"${name}" is empty` })
      hasError = true
      continue
    }

    if (size > MAX_FILE_SIZE) {
      results.push({ error: `"${name}" exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB` })
      hasError = true
      continue
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el4s-upload-'))
    const tmpPath = path.join(tmpDir, name)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(tmpPath, buffer)

    const fileId = uuidv4()
    const ext = name.split('.').pop()
    const key = `${userId}/${fileId}${ext ? `.${ext}` : ''}`
    const mimeType = file.type || 'application/octet-stream'

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: size,
      Metadata: { userId, originalName: name },
    })

    await s3.send(command)

    await db.insert(files).values({
      id: fileId,
      userId,
      name,
      originalName: name,
      key,
      size,
      mimeType,
      isPublic,
      scanStatus: 'pending',
    })

    fireWebhook(userId, 'file.uploaded', { fileId, size, mimeType, isPublic }).catch(() => undefined)

    scanAndHandle(tmpPath, tmpDir, userId, fileId, key, name, mimeType, size, isPublic)

    results.push({ fileId, key, name, size, mimeType, isPublic, scanStatus: 'pending' })
  }

  checkUploadVelocity(userId, fileFields.filter((f) => f instanceof File).length).catch(() => {})
  checkStorageAbuse(userId).catch(() => {})

  if (fileFields.length === 1) {
    const single = results[0]
    if (single.error) {
      return Response.json(single, { status: 400 })
    }
    return Response.json(single)
  }

  const status = hasError ? 207 : 200
  return Response.json({ files: results }, { status })
}

async function scanAndHandle(
  tmpPath: string,
  tmpDir: string,
  userId: string,
  fileId: string,
  key: string,
  fileName: string,
  mimeType: string,
  size: number,
  isPublic: boolean,
) {
  try {
    const checkResult = await checkFile(fileName, tmpPath)

    if (!checkResult.allowed) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      } catch { /* object may already be deleted */ }

      const [currentWarn] = await db
        .select({ warningCount: user.warningCount })
        .from(user)
        .where(eq(user.id, userId))

      const currentCount = currentWarn?.warningCount ?? 0
      const newCount = currentCount + 1

      await db
        .update(user)
        .set({ warningCount: newCount, updatedAt: new Date() })
        .where(eq(user.id, userId))

      const scanResult = checkResult.virusName || checkResult.reason || 'flagged'
      await db
        .update(files)
        .set({ scanStatus: 'scanned', scanResult, scanDuration: checkResult.scanDurationMs })
        .where(eq(files.id, fileId))

      await fireWebhook(userId, 'file.flagged', { fileId, scanResult }).catch(() => undefined)

      if (newCount >= 2) {
        await recordWarning(userId, 'suspension', `Account suspended: repeated Terms of Service violations (${checkResult.reason || 'Blocked file'} - ${fileName})`, fileName)
        await db
          .update(user)
          .set({
            banned: true,
            suspensionReason: `Account suspended: repeated Terms of Service violations (${checkResult.reason || 'Blocked file'} - ${fileName})`,
            suspensionType: 'suspended',
            updatedAt: new Date(),
          })
          .where(eq(user.id, userId))

        console.log(`[upload] Suspended user ${userId} (violation #${newCount}): ${checkResult.reason} for ${fileName}`)

        await fireWebhook(userId, 'user.suspended', { userId, reason: 'Account suspended for repeated violations' }).catch(() => undefined)
      } else {
        await recordWarning(userId, 'warning', `Upload violation: ${checkResult.reason || 'Blocked file'} (${fileName})`, fileName)
        await db
          .update(user)
          .set({
            banned: true,
            suspensionReason: `Upload violation: ${checkResult.reason || 'Blocked file'} (${fileName})`,
            suspensionType: 'warned',
            updatedAt: new Date(),
          })
          .where(eq(user.id, userId))

        console.log(`[upload] Warned user ${userId} (violation #${newCount}): ${checkResult.reason} for ${fileName}`)

        await fireWebhook(userId, 'user.suspended', { userId, reason: 'Upload violation detected', warning: true }).catch(() => undefined)
      }
    } else if (checkResult.scanError) {
      await db
        .update(files)
        .set({ scanStatus: 'error', scanResult: checkResult.scanError, scanDuration: checkResult.scanDurationMs })
        .where(eq(files.id, fileId))

      await fireWebhook(userId, 'file.scanned', { fileId, scanStatus: 'error', scanResult: checkResult.scanError }).catch(() => undefined)
    } else {
      await db
        .update(files)
        .set({ scanStatus: 'scanned', scanResult: 'clean', scanDuration: checkResult.scanDurationMs })
        .where(eq(files.id, fileId))

      await fireWebhook(userId, 'file.scanned', { fileId, scanStatus: 'scanned', scanResult: 'clean' }).catch(() => undefined)
    }
  } catch (err: any) {
    console.error(`[upload] Scan error for ${fileId}:`, err)
    await db
      .update(files)
      .set({ scanStatus: 'error', scanResult: err.message || 'Unknown scan error' })
      .where(eq(files.id, fileId))
  } finally {
    // Clean up temp file
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { /* ignore cleanup errors */ }
  }
}


