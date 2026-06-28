import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ── ClamAV scanning (via clamscan npm package) ──────────────────────────────

const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED !== 'false'

export interface ScanResult {
  infected: boolean
  virusName?: string
  error?: string
}

let _clamscan: any = null
let _clamscanError: string | null = null

async function getClamscan() {
  if (_clamscan !== null) return _clamscan
  if (_clamscanError) return null

  try {
    const dbDir = process.env.CLAMAV_DB_DIR || '/var/lib/clamav'
    const scanBinary = process.env.CLAMSCAN_BIN || ''

    const NodeClam = require('clamscan')
    const instance = await new NodeClam().init({
      removeInfected: false,
      quarantineInfected: false,
      debugMode: process.env.CLAMAV_DEBUG === 'true',
      scanRecursively: false,
      clamscan: {
        path: scanBinary || undefined,
        db: dbDir,
        scanArchives: true,
        active: true,
      },
      clamdscan: {
        active: false,
      },
      preference: 'clamscan',
    })

    try {
      const version = await instance.getVersion()
      console.log(`[file-scan] ClamAV initialized: ${version}`)
    } catch {
      console.warn('[file-scan] ClamAV init OK but version check failed')
    }

    _clamscan = instance
    return _clamscan
  } catch (err: any) {
    _clamscanError = err.message
    console.warn(`[file-scan] ClamAV not available: ${err.message}`)
    return null
  }
}

export async function scanFile(filePath: string): Promise<ScanResult> {
  if (!CLAMAV_ENABLED) {
    return { infected: false }
  }

  const clamscan = await getClamscan()
  if (!clamscan) {
    return { infected: false, error: 'ClamAV not available' }
  }

  try {
    const { isInfected, viruses } = await clamscan.isInfected(filePath)

    if (isInfected) {
      return {
        infected: true,
        virusName: Array.isArray(viruses) ? viruses[0] : String(viruses),
      }
    }

    return { infected: false }
  } catch (err: any) {
    return { infected: false, error: err.message }
  }
}

// ── ZIP archive scanning ─────────────────────────────────────────────────────

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

function isZipFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(4)
    fs.readSync(fd, buf, 0, 4, 0)
    fs.closeSync(fd)
    return buf.equals(ZIP_MAGIC)
  } catch {
    return false
  }
}

/**
 * Scan a ZIP archive by extracting and scanning each entry individually.
 * Returns the first infected result found, or null if all entries are clean.
 */
async function scanZipArchive(zipPath: string): Promise<{ infected: boolean; virusName?: string; reason?: string } | null> {
  const AdmZip = require('adm-zip')
  let zip: any
  try {
    zip = new AdmZip(zipPath)
  } catch (err: any) {
    return { infected: true, reason: `Corrupted or invalid archive: ${err.message}` }
  }

  const entries = zip.getEntries() as any[]
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el4s-entries-'))

  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue

      // Check for encryption flag (bit 0 of general purpose bit flag)
      if (entry.header?.flags !== undefined && (entry.header.flags & 1) === 1) {
        return { infected: true, reason: 'Password-protected/encrypted archive entry' }
      }

      // Extract entry to temp file
      const entryBuf: Buffer = entry.getData()
      // Sanitize entry name to prevent path traversal
      const safeName = path.basename(entry.entryName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'unnamed'
      const entryPath = path.join(tmpDir, safeName)
      fs.writeFileSync(entryPath, entryBuf)

      // Scan this entry with ClamAV
      const result = await scanFile(entryPath)
      if (result.infected) {
        return { infected: true, virusName: result.virusName, reason: `Malware detected in archive entry '${entry.entryName}': ${result.virusName}` }
      }
    }

    return null
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

// ── Unified file check ──────────────────────────────────────────────────────

export interface FileCheckResult {
  allowed: boolean
  reason?: string
  virusName?: string
  scanError?: string
}

export async function checkFile(
  fileName: string,
  filePath: string,
): Promise<FileCheckResult> {
  // For ZIP files, extract and scan each entry
  if (isZipFile(filePath)) {
    const zipResult = await scanZipArchive(filePath)
    if (zipResult?.infected) {
      return {
        allowed: false,
        reason: zipResult.reason || 'Blocked archive content',
        virusName: zipResult.virusName,
      }
    }
  }

  // Also scan the raw file with ClamAV (handles other archive types and non-archives)
  const scanResult = await scanFile(filePath)
  if (scanResult.infected) {
    return {
      allowed: false,
      reason: `Malware detected: ${scanResult.virusName}`,
      virusName: scanResult.virusName,
    }
  }
  if (scanResult.error) {
    // ClamAV unavailable or scan error — allow the file through but flag it
    console.error(`[file-scan] ClamAV error for ${fileName}: ${scanResult.error}`)
    return {
      allowed: true,
      scanError: scanResult.error,
    }
  }

  return { allowed: true }
}
