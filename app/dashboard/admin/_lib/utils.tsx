export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export const SUSPENSION_REASONS = [
  'Flagged file upload',
  'Terms of service violation',
  'Abusive behavior',
  'Copyright infringement',
  'Spam or phishing',
  'Unauthorized access',
  'Other',
]

export const statusBadge: Record<string, { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

export function sectionTitle(title: string) {
  return <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
}

export function formatVerificationMeta(meta?: string | null) {
  if (!meta) return null
  try {
    return JSON.stringify(JSON.parse(meta), null, 2)
  } catch {
    return meta
  }
}
