import * as fs from 'fs'

// ── ClamAV scanning (via clamscan npm package) ──────────────────────────────

const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED !== 'false'

export interface ScanResult {
  infected: boolean
  virusName?: string
  error?: string
  scanDurationMs?: number
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

// Serialize scans — only one at a time to avoid OOM
let scanQueue: Promise<void> = Promise.resolve()

export async function scanFile(filePath: string): Promise<ScanResult> {
  let release: () => void
  const wait = new Promise<void>((r) => { release = r })
  const prev = scanQueue
  scanQueue = prev.then(() => wait)
  await prev

  try {
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

    const start = Date.now()
    const { isInfected, viruses } = await clamscan.isInfected(filePath)
    const elapsed = Date.now() - start

    if (isInfected) {
      const name = Array.isArray(viruses) ? viruses[0] : String(viruses)
      console.log(`[file-scan] INFECTED: ${filePath} -> ${name} (${elapsed}ms)`)
      return {
        infected: true,
        virusName: name,
        scanDurationMs: elapsed,
      }
    }

    console.log(`[file-scan] CLEAN: ${filePath} (${elapsed}ms)`)
    return { infected: false, scanDurationMs: elapsed }
  } catch (err: any) {
    console.error(`[file-scan] SCAN ERROR for ${filePath}: ${err.message}`)
    return { infected: false, error: err.message }
  } finally {
    release()
  }
}

// ── Unified file check ──────────────────────────────────────────────────────

export interface FileCheckResult {
  allowed: boolean
  reason?: string
  virusName?: string
  scanError?: string
  scanDurationMs?: number
}

export async function checkFile(
  fileName: string,
  filePath: string,
): Promise<FileCheckResult> {
  const fileSize = logFileSize(filePath)
  console.log(`[file-scan] checkFile start: "${fileName}" (${fileSize})`)

  const scanResult = await scanFile(filePath)

  if (scanResult.infected) {
    console.log(`[file-scan] RESULT: "${fileName}" BLOCKED — ${scanResult.virusName}`)
    return {
      allowed: false,
      reason: `Malware detected: ${scanResult.virusName}`,
      virusName: scanResult.virusName,
      scanDurationMs: scanResult.scanDurationMs,
    }
  }
  if (scanResult.error) {
    console.error(`[file-scan] RESULT: "${fileName}" SCAN ERROR — ${scanResult.error} (allowing through)`)
    return {
      allowed: true,
      scanError: scanResult.error,
      scanDurationMs: scanResult.scanDurationMs,
    }
  }

  console.log(`[file-scan] RESULT: "${fileName}" ALLOWED — clean`)
  return { allowed: true, scanDurationMs: scanResult.scanDurationMs }
}
