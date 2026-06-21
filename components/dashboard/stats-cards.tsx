import { Files, Globe, HardDrive, Lock, Coins } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Stats {
  totalFiles: number
  totalSize: number
  publicFiles: number
  privateFiles: number
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const statDefs = [
  {
    key: 'totalFiles' as const,
    label: 'Total Files',
    icon: Files,
    format: (v: number) => v.toString(),
    iconColor: 'text-foreground',
    iconBg: 'bg-secondary',
  },
  {
    key: 'totalSize' as const,
    label: 'Storage Used',
    icon: HardDrive,
    format: null as ((totalSize: number) => string) | null,
    iconColor: 'text-foreground',
    iconBg: 'bg-secondary',
  },
  {
    key: 'publicFiles' as const,
    label: 'Public Files',
    icon: Globe,
    format: (v: number) => v.toString(),
    iconColor: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-950',
  },
  {
    key: 'privateFiles' as const,
    label: 'Private Files',
    icon: Lock,
    format: (v: number) => v.toString(),
    iconColor: 'text-muted-foreground',
    iconBg: 'bg-secondary',
  },
]

export function StatsCards({ stats, storageLimit, credits }: { stats: Stats; storageLimit: number; credits: { remaining: number } }) {
  const formatUsage = (totalSize: number) => {
    const pct = Math.round((totalSize / storageLimit) * 100)
    return `${formatBytes(totalSize)} / ${formatBytes(storageLimit)} (${pct}%)`
  }

  const items = statDefs.map((def) =>
    def.key === 'totalSize' ? { ...def, format: formatUsage } : def,
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ key, label, icon: Icon, format, iconColor, iconBg }) => (
        <Card key={key}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">
                  {format(stats[key])}
                </p>
              </div>
              <div className={`size-8 rounded-lg flex items-center justify-center ${iconBg}`}>
                <Icon className={`size-4 ${iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Credits Remaining</p>
              <p className="text-2xl font-semibold tracking-tight mt-1">{credits.remaining}</p>
              <p className="text-xs text-muted-foreground mt-0.5">resets monthly</p>
            </div>
            <div className="size-8 rounded-lg flex items-center justify-center bg-yellow-100 dark:bg-yellow-950">
              <Coins className="size-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
