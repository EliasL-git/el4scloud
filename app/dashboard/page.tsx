'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { getFileStats, getStorageLimit } from '@/app/actions/files'
import { Card, CardContent } from '@/components/ui/card'
import { HardDrive, ArrowRight, FileText } from 'lucide-react'
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/storage"
          className="group relative rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="size-9 rounded-lg bg-secondary flex items-center justify-center">
              <HardDrive className="size-4 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-1">Storage</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Store, manage, and serve your files.
          </p>
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{stats.totalFiles} files</span>
              <span className="text-muted-foreground">{formatBytes(stats.totalSize)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Open service <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          href="/dashboard/keys"
          className="group relative rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="size-9 rounded-lg bg-secondary flex items-center justify-center">
              <FileText className="size-4 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-1">API Keys</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Manage your API keys and access tokens.
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Open service <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          href="/dashboard/settings"
          className="group relative rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="size-9 rounded-lg bg-secondary flex items-center justify-center">
              <HardDrive className="size-4 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-1">Settings</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Manage your profile, storage, and account.
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Open service <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>
    </div>
  )
}
