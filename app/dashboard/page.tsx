'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getFileStats, getStorageLimit } from '@/app/actions/files'
import { HardDrive, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const services = [
  {
    id: 'storage',
    title: 'Storage',
    description: 'Store, manage, and serve your files with our simple API.',
    href: '/dashboard/storage',
    icon: HardDrive,
    status: 'active' as const,
  },
  {
    id: 'ai',
    title: 'AI Chat',
    description: 'Free AI access for Hack Club students.',
    href: '/dashboard/ai',
    icon: Sparkles,
    status: 'active' as const,
  },
]

export default function DashboardOverview() {
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0 })
  const [storageLimit, setStorageLimit] = useState(0)

  useEffect(() => {
    Promise.all([getFileStats(), getStorageLimit()]).then(([s, limit]) => {
      setStats(s)
      setStorageLimit(limit)
    })
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome to Hobbycloud. Select a service below to get started.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const Icon = service.icon
          const isActive = service.status === 'active'

          return (
            <Link
              key={service.id}
              href={service.href ?? '#'}
              className={cn(
                'group relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-all',
                isActive
                  ? 'hover:border-foreground/20 hover:shadow-md cursor-pointer'
                  : 'opacity-50 cursor-default'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                {service.status === 'coming-soon' && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
                    Soon
                  </span>
                )}
              </div>

              <h3 className="text-sm font-semibold mb-1">{service.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {service.description}
              </p>

              {service.id === 'storage' && isActive && (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stats.totalFiles} files</span>
                    <span className="text-muted-foreground">
                      {formatBytes(stats.totalSize)} / {formatBytes(storageLimit)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground/20 transition-all"
                      style={{ width: `${Math.min((stats.totalSize / (storageLimit || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {isActive && (
                <div className="flex items-center gap-1 text-xs font-medium text-foreground/60 group-hover:text-foreground transition-colors">
                  Open service
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
