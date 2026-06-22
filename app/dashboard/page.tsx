'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFiles, getFileStats, getStorageLimit } from '@/app/actions/files'
import { FileUploader } from '@/components/dashboard/file-uploader'
import { FileList } from '@/components/dashboard/file-list'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'

type FileRecord = Awaited<ReturnType<typeof getFiles>>[number]
type Stats = Awaited<ReturnType<typeof getFileStats>>

export default function DashboardPage() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [stats, setStats] = useState<Stats>({
    totalFiles: 0,
    totalSize: 0,
    publicFiles: 0,
    privateFiles: 0,
  })
  const [storageLimit, setStorageLimit] = useState(15 * 1024 * 1024 * 1024)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [f, s, limit] = await Promise.all([getFiles(), getFileStats(), getStorageLimit()])
    setFiles(f)
    setStats(s)
    setStorageLimit(limit)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Files</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload and manage your files.
        </p>
      </div>

      <StatsCards stats={stats} storageLimit={storageLimit} />

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-foreground">Upload files</h2>
        <FileUploader onUploadComplete={refresh} />
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Your files</h2>
          <span className="text-xs text-muted-foreground">{stats.totalFiles} file{stats.totalFiles !== 1 ? 's' : ''}</span>
        </div>
        <FileList files={files} loading={loading} onRefresh={refresh} />
      </div>

      <Toaster />
    </div>
  )
}
