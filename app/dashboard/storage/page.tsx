'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFileStats, getStorageLimit } from '@/app/actions/files'
import { getAccountStatus } from '@/app/actions/warnings'
import { FileUploader } from '@/components/dashboard/file-uploader'
import { FileManager } from '@/components/dashboard/file-manager'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Card, CardContent } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { ViolationWarningDialog } from '@/components/dashboard/violation-warning-dialog'
import { WarningBanner } from '@/components/dashboard/warning-banner'
import { HardDrive, IdCard, HardDriveUpload, Files, LayoutDashboard, Upload } from 'lucide-react'
import { HC_STORAGE_LIMIT } from '@/lib/storage'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'upload' | 'files'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'files', label: 'Files', icon: Files },
]

type Stats = Awaited<ReturnType<typeof getFileStats>>

export default function StoragePage() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab')
      if (p === 'upload' || p === 'files' || p === 'overview') return p
    }
    return 'overview'
  })
  const [stats, setStats] = useState<Stats>({
    totalFiles: 0,
    totalSize: 0,
    publicFiles: 0,
    privateFiles: 0,
  })
  const [storageLimit, setStorageLimit] = useState(15 * 1024 * 1024 * 1024)
  const [isSuspended, setIsSuspended] = useState(false)
  const [warnedInfo, setWarnedInfo] = useState<{ fileName?: string; reason?: string; suspended?: boolean } | null>(null)
  const [bannerInfo, setBannerInfo] = useState<{ reason?: string; suspended?: boolean } | null>(null)

  const refresh = useCallback(async () => {
    const [s, limit] = await Promise.all([getFileStats(), getStorageLimit()])
    setStats(s)
    setStorageLimit(limit)
  }, [])

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
    setWarnedInfo(null)
    await refresh()
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

      <div className="hidden lg:block">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <HardDrive className="size-5" />
          Storage
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isSuspended ? 'You can download your data. Upload is disabled.' : 'Upload and manage your files.'}
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-0.5 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors shrink-0',
              tab === id
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && (
        <section className="flex flex-col gap-6">
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
                  <h3 className="text-sm font-semibold">No Storage allocated yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You need to apply for Storage before you can upload files.{' '}
                    Use the <strong>Need more storage? Apply.</strong> link in the footer to request storage from an admin.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ===== UPLOAD ===== */}
      {tab === 'upload' && (
        <section>
          {isSuspended ? (
            <Card>
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <HardDriveUpload className="size-8 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">Upload disabled</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your account has been suspended. You can download your data but cannot upload new files.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : storageLimit === 0 ? (
            <Card>
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <HardDrive className="size-8 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">No Storage allocated</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You need to apply for Storage before you can upload files.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Drag and drop files or click to browse. Max upload size is determined by your storage quota.
              </p>
              <FileUploader onUploadComplete={refresh} onWarningDismissed={handleFileUploaderWarningDismissed} />
            </div>
          )}
        </section>
      )}

      {/* ===== FILES ===== */}
      {tab === 'files' && (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Browse, download, and manage your uploaded files.
          </p>
          <FileManager onRefresh={refresh} />
        </section>
      )}

      <div className="text-[11px] text-muted-foreground text-center border-t border-border pt-4 mt-2">
        Built with ❤️ on our API
      </div>

      <Toaster />

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
