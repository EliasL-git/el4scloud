'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { files, user, flaggedHashes } from '@/lib/db/schema'
import { and, desc, eq, or, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { s3, S3_BUCKET } from '@/lib/s3'
import { isBadHash } from '@/lib/hash-check'
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { logAuditEvent, logAuditEventWithHeaders } from '@/lib/audit'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getFiles() {
  const userId = await getUserId()
  return db
    .select()
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        // Exclude blocked/flagged files (stored for admin visibility only)
        or(eq(files.scanStatus, 'error'), eq(files.scanResult, 'clean'), isNull(files.scanResult)),
      )
    )
    .orderBy(desc(files.createdAt))
}

export async function getPresignedUploadUrl(
  fileName: string,
  mimeType: string,
  size: number,
  isPublic: boolean,
  fileHash: string,
) {
  const userId = await getUserId()
  if (await isBadHash(fileHash)) {
    throw new Error('This file is blocked due to a known malicious hash')
  }

  const fileId = uuidv4()
  const ext = fileName.split('.').pop()
  const key = `${userId}/${fileId}${ext ? `.${ext}` : ''}`

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: size,
    Metadata: {
      userId,
      originalName: fileName,
    },
  })

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })

  await db.insert(files).values({
    id: fileId,
    userId,
    name: fileName,
    originalName: fileName,
    key,
    size,
    mimeType,
    isPublic,
    fileHash,
  })

  await logAuditEventWithHeaders(userId, 'file.upload_initiated', JSON.stringify({ fileId, fileName, size, mimeType, isPublic, fileHash }))

  return { presignedUrl, fileId, key }
}

export async function deleteFile(fileId: string) {
  const userId = await getUserId()
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

  if (!file) throw new Error('File not found')

  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: file.key }))
  await db.delete(files).where(and(eq(files.id, fileId), eq(files.userId, userId)))

  await logAuditEventWithHeaders(userId, 'file.deleted', JSON.stringify({ fileId, fileName: file.originalName, size: file.size }))

  revalidatePath('/dashboard')
}

export async function toggleFileVisibility(fileId: string) {
  const userId = await getUserId()
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

  if (!file) throw new Error('File not found')

  await db
    .update(files)
    .set({ isPublic: !file.isPublic, updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

  await logAuditEventWithHeaders(userId, `file.${file.isPublic ? 'made_private' : 'made_public'}`, JSON.stringify({ fileId, fileName: file.originalName }))

  revalidatePath('/dashboard')
}

export async function getFileStats() {
  const userId = await getUserId()
  const userFiles = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        or(eq(files.scanStatus, 'error'), eq(files.scanResult, 'clean'), isNull(files.scanResult)),
      )
    )

  const totalSize = userFiles.reduce((acc, f) => acc + f.size, 0)
  const publicCount = userFiles.filter((f) => f.isPublic).length

  return {
    totalFiles: userFiles.length,
    totalSize,
    publicFiles: publicCount,
    privateFiles: userFiles.length - publicCount,
  }
}

export async function getStorageLimit() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [u] = await db
    .select({ storageLimit: user.storageLimit })
    .from(user)
    .where(eq(user.id, session.user.id))

  return u?.storageLimit ?? 15 * 1024 * 1024 * 1024
}

export async function flagFile(fileId: string) {
  const userId = await getUserId()

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))

  if (!file) throw new Error('File not found')
  if (!file.fileHash) throw new Error('File hash not available')

  await db.insert(flaggedHashes).values({
    id: uuidv4(),
    hash: file.fileHash,
    fileId: file.id,
    flaggedBy: userId,
  }).catch(() => {
    throw new Error('Hash was already flagged')
  })

  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: file.key }))
  await db.delete(files).where(eq(files.id, fileId))

  await db
    .update(user)
    .set({ banned: true, suspensionReason: `Flagged file: ${file.originalName} (${file.fileHash.slice(0, 12)}...)`, suspensionType: 'suspended', terminatedAt: null, appealable: true })
    .where(eq(user.id, file.userId))

  await logAuditEventWithHeaders(userId, 'file.flagged', JSON.stringify({ fileId, fileName: file.originalName, fileHash: file.fileHash, targetUserId: file.userId }))

  revalidatePath('/dashboard')
}
