'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { storageRequests } from '@/lib/db/schema'
import crypto from 'crypto'

export async function submitStorageRequest(
  reason: string,
  amount: string,
  age: number,
  firstName: string,
  lastName: string,
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  await db.insert(storageRequests).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    age,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    amount,
    reason,
  })

  return { ok: true }
}
