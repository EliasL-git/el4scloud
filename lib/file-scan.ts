import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ── Bad pattern checking ────────────────────────────────────────────────────

export interface BadPatternResult {
  isBad: boolean
  reason?: string
}

const SUSPICIOUS_FILENAME_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\..*?\.[a-z]{2,4}$/i, reason: 'Suspicious double extension' },
  { pattern: /[\u202E\u200F\u200E]/, reason: 'Unicode direction override characters detected' },
  { pattern: /\0/, reason: 'Null byte in filename' },
  { pattern: /^(?:ntuser\.dat|boot\.ini|pagefile\.sys|config\.sys|autoexec\.bat)$/i, reason: 'Filename impersonates system file' },
  { pattern: /\.[a-z0-9]{10,}$/i, reason: 'Suspiciously long file extension' },
]

export function checkFilenamePatterns(fileName: string): BadPatternResult {
  for (const { pattern, reason } of SUSPICIOUS_FILENAME_PATTERNS) {
    if (pattern.test(fileName)) {
      return { isBad: true, reason }
    }
  }
  return { isBad: false }
}

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

// ── Unified file check ──────────────────────────────────────────────────────

export interface FileCheckResult {
  allowed: boolean
  reason?: string
  virusName?: string
}

export async function checkFile(
  fileName: string,
  filePath: string,
): Promise<FileCheckResult> {
  const patternResult = checkFilenamePatterns(fileName)
  if (patternResult.isBad) {
    return {
      allowed: false,
      reason: patternResult.reason,
    }
  }

  const scanResult = await scanFile(filePath)
  if (scanResult.infected) {
    return {
      allowed: false,
      reason: `Malware detected: ${scanResult.virusName}`,
      virusName: scanResult.virusName,
    }
  }
  if (scanResult.error) {
    console.error(`[file-scan] ClamAV error for ${fileName}: ${scanResult.error}`)
    return {
      allowed: false,
      reason: `Security scan failed: ${scanResult.error}`,
    }
  }

  return { allowed: true }
}
