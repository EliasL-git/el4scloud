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

  const dbDir = process.env.CLAMAV_DB_DIR || '/var/lib/clamav'
  const scanBinary = process.env.CLAMSCAN_BIN || ''

  console.log(`[file-scan] Initializing ClamAV (binary=${scanBinary || 'PATH search'}, db=${dbDir})`)

  try {
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
      console.log(`[file-scan] ClamAV initialized successfully: ${version}`)
    } catch {
      console.warn('[file-scan] ClamAV init OK but version check failed (binary may still work)')
    }

    _clamscan = instance
    return _clamscan
  } catch (err: any) {
    _clamscanError = err.message
    console.error(`[file-scan] ClamAV initialization FAILED: ${err.message}`)
    return null
  }
}

function logFileSize(filePath: string): string {
  try {
    const stat = fs.statSync(filePath)
    const bytes = stat.size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  } catch {
    return 'unknown size'
  }
}

export async function scanFile(filePath: string): Promise<ScanResult> {
  if (!CLAMAV_ENABLED) {
    console.log(`[file-scan] ClamAV disabled by CLAMAV_ENABLED=false — skipping ${filePath}`)
    return { infected: false }
  }

  const clamscan = await getClamscan()
  if (!clamscan) {
    console.warn(`[file-scan] ClamAV not available — cannot scan ${filePath}`)
    return { infected: false, error: 'ClamAV not available' }
  }

  const fileSize = logFileSize(filePath)
  console.log(`[file-scan] Scanning ${filePath} (${fileSize})...`)

  try {
    const start = Date.now()
    const { isInfected, viruses } = await clamscan.isInfected(filePath)
    const elapsed = Date.now() - start

    if (isInfected) {
      const name = Array.isArray(viruses) ? viruses[0] : String(viruses)
      console.log(`[file-scan] INFECTED: ${filePath} -> ${name} (${elapsed}ms)`)
      return {
        infected: true,
        virusName: name,
      }
    }

    console.log(`[file-scan] CLEAN: ${filePath} (${elapsed}ms)`)
    return { infected: false }
  } catch (err: any) {
    console.error(`[file-scan] SCAN ERROR for ${filePath}: ${err.message}`)
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
    const isZip = buf.equals(ZIP_MAGIC)
    console.log(`[file-scan] ${isZip ? 'ZIP' : 'Not ZIP'} (magic: ${buf.toString('hex')}) — ${path.basename(filePath)}`)
    return isZip
  } catch {
    console.warn(`[file-scan] Could not read magic bytes for ${path.basename(filePath)}`)
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
    console.error(`[file-scan] ZIP open failed for ${path.basename(zipPath)}: ${err.message}`)
    return { infected: true, reason: `Corrupted or invalid archive: ${err.message}` }
  }

  const entries = zip.getEntries() as any[]
  const totalEntries = entries.filter((e: any) => !e.isDirectory).length
  const totalDirs = entries.filter((e: any) => e.isDirectory).length
  console.log(`[file-scan] ZIP ${path.basename(zipPath)}: ${totalEntries} files, ${totalDirs} directories`)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el4s-entries-'))
  let scanned = 0

  try {
    for (const entry of entries) {
      if (entry.isDirectory) {
        console.log(`[file-scan]   dir:  ${entry.entryName}`)
        continue
      }

      // Check for encryption flag (bit 0 of general purpose bit flag)
      if (entry.header?.flags !== undefined && (entry.header.flags & 1) === 1) {
        console.error(`[file-scan]   BLOCKED: ${entry.entryName} — password-protected/encrypted`)
        return { infected: true, reason: 'Password-protected/encrypted archive entry' }
      }

      // Extract entry to temp file
      const start = Date.now()
      const entryBuf: Buffer = entry.getData()
      // Sanitize entry name to prevent path traversal
      const safeName = path.basename(entry.entryName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'unnamed'
      const entryPath = path.join(tmpDir, safeName)
      fs.writeFileSync(entryPath, entryBuf)
      console.log(`[file-scan]   extracting: ${entry.entryName} (${entryBuf.length} bytes, ${Date.now() - start}ms)`)

      // Scan this entry with ClamAV
      scanned++
      const result = await scanFile(entryPath)
      if (result.infected) {
        console.error(`[file-scan]   INFECTED in archive: ${entry.entryName} -> ${result.virusName}`)
        return { infected: true, virusName: result.virusName, reason: `Malware detected in archive entry '${entry.entryName}': ${result.virusName}` }
      }
    }

    console.log(`[file-scan] ZIP ${path.basename(zipPath)}: all ${scanned} entries clean`)
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
  const fileSize = logFileSize(filePath)
  console.log(`[file-scan] checkFile start: "${fileName}" (${fileSize})`)

  // For ZIP files, extract and scan each entry
  if (isZipFile(filePath)) {
    console.log(`[file-scan] "${fileName}" is a ZIP archive — extracting for entry-level scan`)
    const zipResult = await scanZipArchive(filePath)
    if (zipResult?.infected) {
      console.log(`[file-scan] RESULT: "${fileName}" BLOCKED — ${zipResult.reason}`)
      return {
        allowed: false,
        reason: zipResult.reason || 'Blocked archive content',
        virusName: zipResult.virusName,
      }
    }
    console.log(`[file-scan] "${fileName}" ZIP entries all clean — proceeding to raw scan`)
  }

  // Also scan the raw file with ClamAV (handles other archive types and non-archives)
  console.log(`[file-scan] Raw ClamAV scan for "${fileName}"...`)
  const scanResult = await scanFile(filePath)
  if (scanResult.infected) {
    console.log(`[file-scan] RESULT: "${fileName}" BLOCKED — ${scanResult.virusName}`)
    return {
      allowed: false,
      reason: `Malware detected: ${scanResult.virusName}`,
      virusName: scanResult.virusName,
    }
  }
  if (scanResult.error) {
    // ClamAV unavailable or scan error — allow the file through but flag it
    console.error(`[file-scan] RESULT: "${fileName}" SCAN ERROR — ${scanResult.error} (allowing through)`)
    return {
      allowed: true,
      scanError: scanResult.error,
    }
  }

  console.log(`[file-scan] RESULT: "${fileName}" ALLOWED — clean`)
  return { allowed: true }
}
