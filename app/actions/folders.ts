'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { folders } from '@/lib/db/schema'
import { and, eq, asc, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { logAuditEventWithHeaders } from '@/lib/audit'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function createFolder(name: string, parentFolderId?: string) {
  const userId = await getUserId()
  if (!name.trim()) throw new Error('Folder name is required')

  const id = uuidv4()
  await db.insert(folders).values({ id, name: name.trim(), userId, parentFolderId: parentFolderId ?? null })

  await logAuditEventWithHeaders(userId, 'folder.created', JSON.stringify({ folderId: id, name, parentFolderId }))
  revalidatePath('/dashboard')
  return { id, name: name.trim() }
}

export async function renameFolder(folderId: string, name: string) {
  const userId = await getUserId()
  if (!name.trim()) throw new Error('Folder name is required')

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
  if (!folder) throw new Error('Folder not found')

  await db
    .update(folders)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(folders.id, folderId))

  await logAuditEventWithHeaders(userId, 'folder.renamed', JSON.stringify({ folderId, name }))
  revalidatePath('/dashboard')
}

export async function deleteFolder(folderId: string) {
  const userId = await getUserId()

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
  if (!folder) throw new Error('Folder not found')

  const { moveFilesToParent } = await import('@/app/actions/files')
  await moveFilesToParent(folderId)

  await db.delete(folders).where(eq(folders.id, folderId))

  await logAuditEventWithHeaders(userId, 'folder.deleted', JSON.stringify({ folderId }))
  revalidatePath('/dashboard')
}

export async function getFolders(parentFolderId: string | null = null) {
  const userId = await getUserId()
  return db
    .select()
    .from(folders)
    .where(
      parentFolderId === null
        ? and(eq(folders.userId, userId), isNull(folders.parentFolderId))
        : and(eq(folders.userId, userId), eq(folders.parentFolderId, parentFolderId))
    )
    .orderBy(asc(folders.name))
}

export async function getFolderPath(folderId: string) {
  const userId = await getUserId()
  const path: { id: string; name: string }[] = []
  let currentId: string | null = folderId

  while (currentId) {
    const [folder] = await db
      .select({ id: folders.id, name: folders.name, parentFolderId: folders.parentFolderId })
      .from(folders)
      .where(and(eq(folders.id, currentId), eq(folders.userId, userId)))
    if (!folder) break
    path.unshift({ id: folder.id, name: folder.name })
    currentId = folder.parentFolderId
  }

  return path
}
