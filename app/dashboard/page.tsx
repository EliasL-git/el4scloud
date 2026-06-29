'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFiles, getFileStats, getStorageLimit } from '@/app/actions/files'
import { getAccountStatus } from '@/app/actions/warnings'
import { FileUploader } from '@/components/dashboard/file-uploader'
import { FileList } from '@/components/dashboard/file-list'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { ViolationWarningDialog } from '@/components/dashboard/violation-warning-dialog'
import { WarningBanner } from '@/components/dashboard/warning-banner'
import { HardDrive, IdCard } from 'lucide-react'
import { HC_STORAGE_LIMIT } from '@/lib/storage'

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
  const [isSuspended, setIsSuspended] = useState(false)
  const [warnedInfo, setWarnedInfo] = useState<{ fileName?: string; reason?: string; suspended?: boolean } | null>(null)
  const [bannerInfo, setBannerInfo] = useState<{ reason?: string; suspended?: boolean } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [f, s, limit] = await Promise.all([getFiles(), getFileStats(), getStorageLimit()])
    setFiles(f)
    setStats(s)
    setStorageLimit(limit)
    setLoading(false)
  }, [])

  // Check for account warnings on load
  useEffect(() => {
    const checkWarnings = async () => {
      const status = await getAccountStatus()
      if (status?.suspended) {
        setIsSuspended(true)
        setWarnedInfo({ reason: status.reason ?? undefined, suspended: true })
      } else if (status?.warned) {
        setIsSuspended(false)
        setWarnedInfo({ reason: status.reason ?? undefined })
      } else {
        setIsSuspended(false)
      }
    }
    Promise.all([refresh(), checkWarnings()])
  }, [refresh])

  const handleWarningClose = async () => {
    const prev = warnedInfo
    setWarnedInfo(null)
    await refresh()
    // Re-check status — if still warned/suspended, show the banner
    const status = await getAccountStatus()
    if (status?.warned) {
      setBannerInfo({ reason: status.reason ?? undefined })
    } else if (status?.suspended) {
      setBannerInfo({ reason: status.reason ?? undefined, suspended: true })
    }
  }

  const handleBannerReactivate = () => {
    if (bannerInfo) {
      setWarnedInfo({ reason: bannerInfo.reason, suspended: bannerInfo.suspended })
      setBannerInfo(null)
    }
  }

  const handleBannerDismiss = () => {
    setBannerInfo(null)
  }

  const handleFileUploaderWarningDismissed = async () => {
    // Re-check account status to show the right banner
    const status = await getAccountStatus()
    if (status?.warned) {
      setBannerInfo({ reason: status.reason ?? undefined })
    } else if (status?.suspended) {
      setBannerInfo({ reason: status.reason ?? undefined, suspended: true })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {bannerInfo && (
        <WarningBanner
          reason={bannerInfo.reason}
          suspended={bannerInfo.suspended}
          onReactivate={!bannerInfo.suspended ? handleBannerReactivate : undefined}
          onDismiss={handleBannerDismiss}
        />
      )}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Files</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isSuspended ? 'You can download your data. Upload is disabled.' : 'Upload and manage your files.'}
        </p>
      </div>

      <StatsCards stats={stats} storageLimit={storageLimit} />

      {storageLimit > 0 && storageLimit < HC_STORAGE_LIMIT && (
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <IdCard className="size-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">Verify your identity</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please verify your identity in order to unlock higher tiers!
              </p>
              <a
                href="/dashboard/settings"
                className="inline-flex items-center gap-1 text-sm font-medium mt-2 underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Go to settings
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {storageLimit === 0 && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <HardDrive className="size-8 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold">No storage allocated yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You need to apply for storage before you can upload files. 
                Use the <strong>Need more storage? Apply.</strong> link in the footer to request storage from an admin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSuspended && storageLimit > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">Upload files</h2>
          <FileUploader onUploadComplete={refresh} onWarningDismissed={handleFileUploaderWarningDismissed} />
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Your files</h2>
          <span className="text-xs text-muted-foreground">{stats.totalFiles} file{stats.totalFiles !== 1 ? 's' : ''}</span>
        </div>
        <FileList files={files} loading={loading} onRefresh={refresh} />
      </div>

      <Toaster />

      {/* Show violation warning if account is warned on page load */}
      <ViolationWarningDialog
        open={warnedInfo !== null}
        onClose={handleWarningClose}
        fileName={warnedInfo?.fileName}
        reason={warnedInfo?.reason}
        suspended={warnedInfo?.suspended}
      />
    </div>
  )
}
