import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ── File type classification ────────────────────────────────────────────────

const SAFE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'tiff', 'tif',
  'txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log',
  'css', 'scss', 'sass', 'less', 'jsx', 'ts', 'tsx', 'vue', 'svelte',
  'js', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'cpp', 'h', 'hpp', 'cs', 'fs', 'ex', 'exs',
  'php', 'pl', 'pm', 'lua', 'r', 'scala', 'clj',
  'env', 'env.example', 'gitignore', 'dockerignore',
  'editorconfig', 'prettierrc', 'eslintrc',
  'html', 'htm', 'xhtml',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
])

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'scr', 'msi', 'msp', 'mst', 'com', 'pif',
  'bat', 'cmd', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'ps1', 'psm1', 'psd1', 'ps1xml', 'pssc', 'psc1',
  'sh', 'bash', 'dash', 'ksh', 'zsh', 'csh',
  'docm', 'dotm', 'xlsm', 'xlam', 'pptm', 'ppam', 'potm', 'ppsm',
  'jar', 'reg', 'inf', 'gadget', 'msu', 'cpl', 'appref-ms',
])

const RISKY_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'dot', 'dotx',
  'xls', 'xlsx', 'xlt', 'xltx',
  'ppt', 'pptx', 'pot', 'potx',
  'zip', 'zipx', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst',
  'tgz', 'tbz2', 'txz',
  'cab', 'arj', 'lzh', 'lha', 'ace',
  'iso', 'img', 'vhd', 'vhdx', 'vmdk', 'dmg',
  'rtf', 'odt', 'ods', 'odp',
  'apk', 'appimage', 'dmg', 'deb', 'rpm',
])

export type FileClassification = 'safe' | 'risky' | 'blocked'

export function classifyFile(fileName: string): FileClassification {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

  if (BLOCKED_EXTENSIONS.has(ext)) return 'blocked'
  if (RISKY_EXTENSIONS.has(ext)) return 'risky'
  if (SAFE_EXTENSIONS.has(ext)) return 'safe'

  // Unknown extensions — treat as risky (scan them)
  return 'risky'
}

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

// Lazy-loaded clamscan instance (init once on first use)
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
        active: false, // Don't use clamd — just clamscan binary
      },
      preference: 'clamscan',
    })

    // Verify it works by getting version
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

/**
 * Run ClamAV scan on a file using the `clamscan` npm package.
 */
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

// ── Unified scan check ──────────────────────────────────────────────────────

export interface FileCheckResult {
  allowed: boolean
  classification: FileClassification
  reason?: string
  virusName?: string
}

/**
 * Full file check: classify, check filename patterns, optionally run ClamAV scan.
 */
export async function checkFile(
  fileName: string,
  filePath: string,
  options?: { skipScan?: boolean }
): Promise<FileCheckResult> {
  const classification = classifyFile(fileName)

  // Blocked extensions are always rejected
  if (classification === 'blocked') {
    return {
      allowed: false,
      classification,
      reason: `File type .${fileName.split('.').pop()?.toLowerCase()} is not allowed for security reasons.`,
    }
  }

  // Check filename patterns for all files
  const patternResult = checkFilenamePatterns(fileName)
  if (patternResult.isBad) {
    return {
      allowed: false,
      classification,
      reason: patternResult.reason,
    }
  }

  // Safe files skip ClamAV scan (unless explicitly requested)
  if (classification === 'safe') {
    return { allowed: true, classification }
  }

  // Risky (or unknown) files get scanned
  if (!options?.skipScan) {
    const scanResult = await scanFile(filePath)
    if (scanResult.infected) {
      return {
        allowed: false,
        classification,
        reason: `Malware detected: ${scanResult.virusName}`,
        virusName: scanResult.virusName,
      }
    }
    if (scanResult.error) {
      console.error(`[file-scan] ClamAV error for ${fileName}: ${scanResult.error}`)
      // If ClamAV fails, err on the side of caution — reject
      return {
        allowed: false,
        classification,
        reason: `Security scan failed: ${scanResult.error}`,
      }
    }
  }

  return { allowed: true, classification }
}
