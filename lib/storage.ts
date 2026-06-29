export const STORAGE_LIMIT = 15 * 1024 * 1024 * 1024 // legacy default
export const NON_HC_STORAGE_LIMIT = 0 // 0 bytes — default for new accounts
export const NO_VERIFICATION_LIMIT = 100 * 1024 * 1024 // 100 MB
export const MANUAL_VERIFICATION_LIMIT = 2.5 * 1024 * 1024 * 1024 // 2.5 GB
export const HC_STORAGE_LIMIT = 50 * 1024 * 1024 * 1024 // 50 GB

const unitMap: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
}

export function parseStorageAmount(input: string): number {
  const match = input.toUpperCase().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/)
  if (!match) return 0
  const num = parseFloat(match[1])
  const unit = match[2] || 'GB'
  return Math.round(num * (unitMap[unit] ?? unitMap.GB))
}
