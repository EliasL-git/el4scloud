import { db } from '@/lib/db'
import { warnings } from '@/lib/db/schema'
import { v4 as uuidv4 } from 'uuid'

export async function recordWarning(
  userId: string,
  type: 'warning' | 'suspension' | 'termination',
  reason: string,
  fileName?: string,
) {
  await db.insert(warnings).values({
    id: uuidv4(),
    userId,
    type,
    reason,
    fileName: fileName ?? null,
  })
}
