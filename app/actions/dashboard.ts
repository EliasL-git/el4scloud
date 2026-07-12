'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { user, files } from '@/lib/db/schema'
import { eq, and, or, isNull } from 'drizzle-orm'

export async function getStorageResource() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [u] = await db
    .select({ storageLimit: user.storageLimit })
    .from(user)
    .where(eq(user.id, session.user.id))

  const userFiles = await db
    .select({ size: files.size })
    .from(files)
    .where(and(
      eq(files.userId, session.user.id),
      or(eq(files.scanStatus, 'error'), eq(files.scanResult, 'clean'), isNull(files.scanResult)),
    ))

  const usageBytes = userFiles.reduce((acc, f) => acc + f.size, 0)
  const totalFiles = userFiles.length
  const limitBytes = u?.storageLimit ?? 0

  return {
    name: `${session.user.name}'s Storage`,
    type: 'S3 Object Storage',
    status: 'Active' as const,
    usageBytes,
    totalFiles,
    limitBytes,
  }
}
