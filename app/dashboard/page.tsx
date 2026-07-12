'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { getFileStats, getStorageLimit } from '@/app/actions/files'
import { Card, CardContent } from '@/components/ui/card'
import { HardDrive, ArrowRight, HardDriveUpload, HardDriveDownload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

type Stats = Awaited<ReturnType<typeof getFileStats>>

export default function DashboardOverview() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats>({ totalFiles: 0, totalSize: 0, publicFiles: 0, privateFiles: 0 })
  const [storageLimit, setStorageLimit] = useState(0)

  useEffect(() => {
    Promise.all([getFileStats(), getStorageLimit()]).then(([s, limit]) => {
      setStats(s)
      setStorageLimit(limit)
    })
  }, [])

  const usagePercent = storageLimit > 0 ? Math.min((stats.totalSize / storageLimit) * 100, 100) : 0
  const usedGB = stats.totalSize / (1024 * 1024 * 1024)
  const limitGB = storageLimit / (1024 * 1024 * 1024)

  const statCards = [
    { label: 'Total files', value: stats.totalFiles, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Public files', value: stats.publicFiles, icon: HardDriveUpload, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Private files', value: stats.privateFiles, icon: HardDriveDownload, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Storage used', value: `${usedGB.toFixed(1)} GB`, icon: HardDrive, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here&apos;s an overview of your storage.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-start gap-3">
              <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
                <Icon className={cn('size-5', color)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storage usage bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <HardDrive className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Storage</p>
                <p className="text-xs text-muted-foreground">{formatBytes(stats.totalSize)} of {formatBytes(storageLimit)} used</p>
              </div>
            </div>
            <Link
              href="/dashboard/storage"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Manage storage <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-muted-foreground">{stats.totalFiles} file{stats.totalFiles !== 1 ? 's' : ''}</span>
            <span className="text-[11px] text-muted-foreground">{usedGB.toFixed(1)} GB / {limitGB.toFixed(1)} GB</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/dashboard/storage?tab=upload"
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <HardDriveUpload className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Upload files</p>
              <p className="text-xs text-muted-foreground mt-0.5">Drag & drop or click to upload</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/settings"
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
              <HardDrive className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Account settings</p>
              <p className="text-xs text-muted-foreground mt-0.5">Manage your profile and storage</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
