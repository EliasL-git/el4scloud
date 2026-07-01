'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { files, user, flaggedHashes, shareLinks } from '@/lib/db/schema'
import { and, desc, eq, or, isNull, ilike } from 'drizzle-orm'
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
import { recordWarning } from '@/lib/warnings'
import { hash } from '@/lib/hash'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getFiles(opts?: { query?: string; folderId?: string | null }) {
  const userId = await getUserId()
  const conditions = [
    eq(files.userId, userId),
    or(eq(files.scanStatus, 'error'), eq(files.scanResult, 'clean'), isNull(files.scanResult)),
  ]
  if (opts?.query) {
    conditions.push(ilike(files.originalName, `%${opts.query}%`))
  }
  if (opts?.folderId !== undefined) {
    if (opts.folderId === null) {
      conditions.push(isNull(files.folderId))
    } else {
      conditions.push(eq(files.folderId, opts.folderId))
    }
  }
  return db
    .select()
    .from(files)
    .where(and(...conditions))
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

export async function setFilePassword(fileId: string, password: string) {
  const userId = await getUserId()
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

  if (!file) throw new Error('File not found')
  if (password && password.length < 4) throw new Error('Password must be at least 4 characters')

  const passwordHash = await hash(password)

  await db
    .update(files)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

  revalidatePath('/dashboard')
}

export async function removeFilePassword(fileId: string) {
  const userId = await getUserId()
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

  if (!file) throw new Error('File not found')

  await db
    .update(files)
    .set({ passwordHash: null, updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

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
  if (file.userId === userId) throw new Error('Cannot flag your own file')
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

  await recordWarning(file.userId, 'suspension', `Flagged file: ${file.originalName} (${file.fileHash.slice(0, 12)}...)`, file.originalName)
  await db
    .update(user)
    .set({ banned: true, suspensionReason: `Flagged file: ${file.originalName} (${file.fileHash.slice(0, 12)}...)`, suspensionType: 'suspended', terminatedAt: null, appealable: true })
    .where(eq(user.id, file.userId))

  await logAuditEventWithHeaders(userId, 'file.flagged', JSON.stringify({ fileId, fileName: file.originalName, fileHash: file.fileHash, targetUserId: file.userId }))

  revalidatePath('/dashboard')
}

export async function getStorageUsage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const userFiles = await db
    .select({ size: files.size })
    .from(files)
    .where(
      and(
        eq(files.userId, session.user.id),
        or(eq(files.scanStatus, 'error'), eq(files.scanResult, 'clean'), isNull(files.scanResult)),
      )
    )

  return userFiles.reduce((acc, f) => acc + f.size, 0)
}

export async function createShareLink(
  fileId: string,
  options?: { expiresAt?: Date; maxDownloads?: number; password?: string },
) {
  const userId = await getUserId()
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, userId)))

  if (!file) throw new Error('File not found')

  const [existing] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.fileId, fileId), eq(shareLinks.userId, userId)))
  if (existing) {
    await db.delete(shareLinks).where(and(eq(shareLinks.fileId, fileId), eq(shareLinks.userId, userId)))
  }

  const passwordHash = options?.password ? await hash(options.password) : null

  const id = uuidv4()
  const token = crypto.randomUUID()

  await db.insert(shareLinks).values({
    id,
    fileId,
    userId,
    token,
    expiresAt: options?.expiresAt ?? null,
    maxDownloads: options?.maxDownloads ?? null,
    passwordHash,
    downloadCount: 0,
  })

  await logAuditEventWithHeaders(userId, 'share_link.created', JSON.stringify({ fileId, token, expiresAt: options?.expiresAt, maxDownloads: options?.maxDownloads, hasPassword: !!passwordHash }))

  revalidatePath('/dashboard')
  return { id, token }
}

export async function revokeShareLink(linkId: string) {
  const userId = await getUserId()
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.id, linkId), eq(shareLinks.userId, userId)))

  if (!link) throw new Error('Share link not found')

  await db.delete(shareLinks).where(and(eq(shareLinks.id, linkId), eq(shareLinks.userId, userId)))

  await logAuditEventWithHeaders(userId, 'share_link.revoked', JSON.stringify({ linkId, fileId: link.fileId, token: link.token }))

  revalidatePath('/dashboard')
}

export async function getShareLinks(fileId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.fileId, fileId), eq(shareLinks.userId, userId)))
    .orderBy(desc(shareLinks.createdAt))
}

export async function moveFilesToFolder(fileIds: string[], folderId: string | null) {
  const userId = await getUserId()
  for (const fileId of fileIds) {
    await db
      .update(files)
      .set({ folderId, updatedAt: new Date() })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
  }
  await logAuditEventWithHeaders(userId, 'files.moved', JSON.stringify({ fileIds, folderId }))
  revalidatePath('/dashboard')
}

export async function moveFilesToParent(folderId: string) {
  const filesInFolder = await db
    .select()
    .from(files)
    .where(eq(files.folderId, folderId))
  for (const file of filesInFolder) {
    await db
      .update(files)
      .set({ folderId: null, updatedAt: new Date() })
      .where(eq(files.id, file.id))
  }
}
