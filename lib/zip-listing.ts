import { s3, S3_BUCKET } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIR_SIGNATURE = 0x02014b50
const EOCD_SIZE = 22
const MAX_COMMENT_SIZE = 65535

interface ZipEntry {
  name: string
  compressedSize: number
  uncompressedSize: number
  method: number // 0 = stored, 8 = deflated
}

function readUInt32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset)
}

function readUInt16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset)
}

async function fetchRange(key: string, start: number, end: number): Promise<Buffer> {
  const cmd = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Range: `bytes=${start}-${end}`,
  })
  const res = await s3.send(cmd)
  if (!res.Body) throw new Error('Empty response')
  return Buffer.from(await res.Body.transformToByteArray())
}

export async function listZipContents(key: string): Promise<ZipEntry[]> {
  const headCmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
  const headRes = await s3.send(headCmd)
  const fileSize = headRes.ContentLength
  if (!fileSize || fileSize < EOCD_SIZE) throw new Error('File too small to be a zip')

  // Fetch the tail of the file to find the EOCD
  const tailStart = Math.max(0, fileSize - EOCD_SIZE - MAX_COMMENT_SIZE)
  const tail = await fetchRange(key, tailStart, fileSize - 1)

  // Find EOCD signature from the end
  let eocdOffset = -1
  for (let i = tail.length - EOCD_SIZE; i >= 0; i--) {
    if (readUInt32LE(tail, i) === EOCD_SIGNATURE) {
      eocdOffset = tailStart + i
      break
    }
  }

  if (eocdOffset === -1) throw new Error('End of Central Directory not found')

  const eocdRelOffset = eocdOffset - tailStart

  // Parse EOCD: signature(4) + diskNum(2) + diskStart(2) + entriesOnDisk(2) + totalEntries(2) + centralDirSize(4) + centralDirOffset(4) + commentLen(2)
  const centralDirOffset = readUInt32LE(tail, eocdRelOffset + 16)
  const centralDirSize = readUInt32LE(tail, eocdRelOffset + 12)
  const totalEntries = readUInt16LE(tail, eocdRelOffset + 10)

  if (totalEntries === 0) return []

  // Fetch the central directory
  const centralDir = await fetchRange(key, centralDirOffset, centralDirOffset + centralDirSize - 1)

  const entries: ZipEntry[] = []
  let pos = 0

  for (let i = 0; i < totalEntries; i++) {
    if (readUInt32LE(centralDir, pos) !== CENTRAL_DIR_SIGNATURE) break

    // Central directory entry: signature(4) + versionMade(2) + versionNeeded(2) + flags(2) + method(2) + time(2) + date(2) + crc32(4) + compSize(4) + uncompSize(4) + nameLen(2) + extraLen(2) + commentLen(2) + diskStart(2) + internalAttr(2) + externalAttr(4) + localOffset(4)
    const method = readUInt16LE(centralDir, pos + 10)
    const compressedSize = readUInt32LE(centralDir, pos + 20)
    const uncompressedSize = readUInt32LE(centralDir, pos + 24)
    const nameLen = readUInt16LE(centralDir, pos + 28)
    const extraLen = readUInt16LE(centralDir, pos + 30)
    const commentLen = readUInt16LE(centralDir, pos + 32)

    const name = centralDir.toString('utf-8', pos + 46, pos + 46 + nameLen)

    entries.push({ name, compressedSize, uncompressedSize, method })
    pos += 46 + nameLen + extraLen + commentLen
  }

  return entries
}
