import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { flaggedHashes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

let badHashes: Set<string> | null = null

function loadBadHashes(): Set<string> {
  if (badHashes) return badHashes

  const csvPath = path.join(process.cwd(), 'hashes', 'Flagged_Hash_List.csv')
  const content = fs.readFileSync(csvPath, 'utf-8')
  const hashes = new Set<string>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed) {
      hashes.add(trimmed.toLowerCase())
    }
  }

  badHashes = hashes
  return badHashes
}

export async function isBadHash(hash: string): Promise<boolean> {
  const lower = hash.toLowerCase()

  if (loadBadHashes().has(lower)) return true

  const [existing] = await db
    .select({ id: flaggedHashes.id })
    .from(flaggedHashes)
    .where(eq(flaggedHashes.hash, lower))

  return !!existing
}
