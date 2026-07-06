import { deflateSync } from 'zlib'

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_SIGNATURE = 0x06054b50

function crc32(data: Buffer): number {
  let c = 0xffffffff
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = 0xedb88320 ^ (crc >>> 1)
      else crc >>>= 1
    }
    table[i] = crc
  }
  for (let i = 0; i < data.length; i++) {
    c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function u16(v: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(v, 0)
  return b
}

function u32(v: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(v, 0)
  return b
}

export interface ZipEntry {
  name: string
  data: Buffer
}

export function createZip(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = []
  const centralEntries: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const compressed = deflateSync(entry.data)
    const checksum = crc32(entry.data)

    localHeaders.push(Buffer.concat([
      u32(LOCAL_HEADER),
      u16(20),        // version needed
      u16(0x0800),    // general purpose: UTF-8
      u16(8),         // compression method: deflate
      u16(0),         // last mod time
      u16(0),         // last mod date
      u32(checksum),
      u32(compressed.length),
      u32(entry.data.length),
      u16(nameBuf.length),
      u16(0),         // extra field length
      nameBuf,
    ]))

    centralEntries.push(Buffer.concat([
      u32(CENTRAL_HEADER),
      u16(20),        // version made by
      u16(20),        // version needed
      u16(0x0800),    // general purpose: UTF-8
      u16(8),         // compression method
      u16(0),         // last mod time
      u16(0),         // last mod date
      u32(checksum),
      u32(compressed.length),
      u32(entry.data.length),
      u16(nameBuf.length),
      u16(0),         // extra field length
      u16(0),         // file comment length
      u16(0),         // disk number start
      u16(0),         // internal file attributes
      u32(0),         // external file attributes
      u32(offset),
      nameBuf,
    ]))

    offset += localHeaders[localHeaders.length - 1].length + compressed.length
    localHeaders[localHeaders.length - 1] = Buffer.concat([localHeaders[localHeaders.length - 1], compressed])
  }

  const centralStart = offset
  const central = Buffer.concat(centralEntries)
  const centralSize = central.length
  const endCentral = Buffer.concat([
    u32(END_SIGNATURE),
    u16(0),         // disk number
    u16(0),         // disk with central
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(centralStart),
    u16(0),         // comment length
  ])

  return Buffer.concat([...localHeaders, central, endCentral])
}
