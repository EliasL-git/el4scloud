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

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

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

  // Check if user is currently warned or suspended and check storage limit
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

  if (!currentUser || currentUser.storageLimit === 0) {
    return Response.json({
      error: 'You need to apply for storage before uploading files. Visit your dashboard to submit a storage request.',
    }, { status: 403 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const fileField = formData.get('file')
  if (!fileField || !(fileField instanceof File)) {
    return Response.json({ error: 'File is required' }, { status: 400 })
  }

  const file = fileField as File
  const fileName = formData.get('fileName')?.toString() || file.name
  const isPublic = formData.get('isPublic') === 'true'
  const size = file.size

  if (size === 0) {
    return Response.json({ error: 'File is empty' }, { status: 400 })
  }

  if (size > MAX_FILE_SIZE) {
    return Response.json({
      error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB`,
    }, { status: 400 })
  }

  // Write file to temporary location for async scanning
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el4s-upload-'))
  const tmpPath = path.join(tmpDir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(tmpPath, buffer)

  // Upload to S3 immediately
  const fileId = uuidv4()
  const ext = fileName.split('.').pop()
  const key = `${userId}/${fileId}${ext ? `.${ext}` : ''}`
  const mimeType = file.type || 'application/octet-stream'

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: size,
    Metadata: {
      userId,
      originalName: fileName,
    },
  })

  await s3.send(command)

  // Insert file record (pending scan)
  await db.insert(files).values({
    id: fileId,
    userId,
    name: fileName,
    originalName: fileName,
    key,
    size,
    mimeType,
    isPublic,
    scanStatus: 'pending',
  })

  ;(async () => {
    await fireWebhook(userId, 'file.uploaded', { fileId, size, mimeType, isPublic }).catch(() => undefined)
  })()

  const response = Response.json({
    fileId,
    key,
    name: fileName,
    size,
    mimeType,
    isPublic,
    scanStatus: 'pending',
  })

  // Asynchronously scan and handle flagged files (after response)
  scanAndHandle(tmpPath, tmpDir, userId, fileId, key, fileName, file.type || 'application/octet-stream', size, isPublic)

  return response
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


