'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { files, user } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

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
    .where(eq(files.userId, userId))
    .orderBy(desc(files.createdAt))
}

export async function getPresignedUploadUrl(
  fileName: string,
  mimeType: string,
  size: number,
  isPublic: boolean,
) {
  const userId = await getUserId()

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
  })

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

  revalidatePath('/dashboard')
}

export async function getFileStats() {
  const userId = await getUserId()
  const userFiles = await db
    .select()
    .from(files)
    .where(eq(files.userId, userId))

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
