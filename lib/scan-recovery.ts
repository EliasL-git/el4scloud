import { db } from '@/lib/db'
import { files, user } from '@/lib/db/schema'
import { s3, S3_BUCKET } from '@/lib/s3'
import { eq } from 'drizzle-orm'
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { checkFile } from '@/lib/file-scan'
import { recordWarning } from '@/lib/warnings'
import { fireWebhook } from '@/lib/webhooks/fire'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

let recovered = false

export async function recoverPendingScans() {
  if (recovered) return
  recovered = true

  // Wait a few seconds for the server to fully initialize
  await new Promise((r) => setTimeout(r, 5000))

  try {
    const pending = await db
      .select({ id: files.id, key: files.key, name: files.name, userId: files.userId })
      .from(files)
      .where(eq(files.scanStatus, 'pending'))

    if (pending.length === 0) return

    console.log(`[scan-recovery] Found ${pending.length} pending files to scan`)

    for (const file of pending) {
      await scanPendingFile(file.id, file.key, file.name, file.userId)
    }

    console.log('[scan-recovery] All pending files processed')
  } catch (err: any) {
    console.error('[scan-recovery] Recovery error:', err)
  }
}

async function scanPendingFile(fileId: string, key: string, fileName: string, userId: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el4s-recovery-'))
  const tmpPath = path.join(tmpDir, fileName)

  try {
    // Download from S3
    const response = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    const body = await response.Body?.transformToByteArray()
    if (!body) throw new Error('Empty file body')
    fs.writeFileSync(tmpPath, Buffer.from(body))

    // Scan
    const checkResult = await checkFile(fileName, tmpPath)

    if (!checkResult.allowed) {
      // Malware detected — delete from S3 and warn/suspend user
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      } catch { /* already deleted */ }

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

        await fireWebhook(userId, 'user.suspended', { userId, reason: 'Upload violation detected', warning: true }).catch(() => undefined)
      }

      console.log(`[scan-recovery] Flagged + deleted file ${fileId} (${fileName}) — user ${newCount >= 2 ? 'suspended' : 'warned'}`)
    } else if (checkResult.scanError) {
      await db
        .update(files)
        .set({ scanStatus: 'error', scanResult: checkResult.scanError, scanDuration: checkResult.scanDurationMs })
        .where(eq(files.id, fileId))

      await fireWebhook(userId, 'file.scanned', { fileId, scanStatus: 'error', scanResult: checkResult.scanError }).catch(() => undefined)
      console.log(`[scan-recovery] Scan error for ${fileId} (${fileName}): ${checkResult.scanError}`)
    } else {
      await db
        .update(files)
        .set({ scanStatus: 'scanned', scanResult: 'clean', scanDuration: checkResult.scanDurationMs })
        .where(eq(files.id, fileId))

      await fireWebhook(userId, 'file.scanned', { fileId, scanStatus: 'scanned', scanResult: 'clean' }).catch(() => undefined)
      console.log(`[scan-recovery] File ${fileId} (${fileName}) marked clean`)
    }
  } catch (err: any) {
    console.error(`[scan-recovery] Failed to scan ${fileId}:`, err)
    await db
      .update(files)
      .set({ scanStatus: 'error', scanResult: err.message || 'Recovery scan failed' })
      .where(eq(files.id, fileId))
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
