'use client'

import { useState } from 'react'
import {
  FileIcon,
  FileImageIcon,
  FileVideoIcon,
  FileTextIcon,
  FileArchiveIcon,
  Trash2,
  Globe,
  Lock,
  Copy,
  MoreHorizontal,
  Share2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { deleteFile, toggleFileVisibility, createShareLink, revokeShareLink, getShareLinks } from '@/app/actions/files'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FileRecord {
  id: string
  userId: string
  name: string
  originalName: string
  key: string
  size: number
  mimeType: string
  isPublic: boolean
  passwordHash: string | null
  createdAt: Date
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const cls = 'size-8 p-1.5 rounded-lg shrink-0'
  if (mimeType.startsWith('image/'))
    return (
      <div className={cn(cls, 'bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400')}>
        <FileImageIcon className="size-full" />
      </div>
    )
  if (mimeType.startsWith('video/'))
    return (
      <div className={cn(cls, 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400')}>
        <FileVideoIcon className="size-full" />
      </div>
    )
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml'))
    return (
      <div className={cn(cls, 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400')}>
        <FileTextIcon className="size-full" />
      </div>
    )
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip'))
    return (
      <div className={cn(cls, 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400')}>
        <FileArchiveIcon className="size-full" />
      </div>
    )
  return (
    <div className={cn(cls, 'bg-secondary text-muted-foreground')}>
      <FileIcon className="size-full" />
    </div>
  )
}

export function FileList({
  files,
  loading,
  onRefresh,
}: {
  files: FileRecord[]
  loading: boolean
  onRefresh?: () => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [shareDialog, setShareDialog] = useState<{ fileId: string; open: boolean } | null>(null)
  const [shareLinksData, setShareLinksData] = useState<{ id: string; token: string; expiresAt: Date | null; maxDownloads: number | null; downloadCount: number; createdAt: Date }[]>([])
  const [shareLoaded, setShareLoaded] = useState(false)
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareExpiry, setShareExpiry] = useState('')
  const [shareMaxDownloads, setShareMaxDownloads] = useState('')
  const [sharePassword, setSharePassword] = useState('')
  const [sharePasswordEnabled, setSharePasswordEnabled] = useState(false)
  const [revokingShare, setRevokingShare] = useState<string | null>(null)

  const handleToggle = async (id: string) => {
    setTogglingId(id)
    try {
      await toggleFileVisibility(id)
      onRefresh?.()
    } catch {
      toast.error('Failed to update visibility')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteFile(id)
      onRefresh?.()
      toast.success('File deleted')
    } catch {
      toast.error('Failed to delete file')
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  const handleOpenShare = async (fileId: string) => {
    setShareDialog({ fileId, open: true })
    setShareLoaded(false)
    setShareExpiry('')
    setShareMaxDownloads('')
    setSharePassword('')
    setSharePasswordEnabled(false)
    try {
      const links = await getShareLinks(fileId)
      setShareLinksData(links.map((l) => ({ ...l, expiresAt: l.expiresAt ? new Date(l.expiresAt) : null })))
    } catch {
      setShareLinksData([])
    }
    setShareLoaded(true)
  }

  const handleCreateShare = async () => {
    if (!shareDialog) return
    setCreatingShare(true)
    try {
      const options: { expiresAt?: Date; maxDownloads?: number; password?: string } = {}
      if (shareExpiry) options.expiresAt = new Date(shareExpiry)
      if (shareMaxDownloads) options.maxDownloads = parseInt(shareMaxDownloads, 10)
      if (sharePasswordEnabled && sharePassword.trim()) options.password = sharePassword.trim()
      const link = await createShareLink(shareDialog.fileId, options)
      toast.success('Share link created')
      navigator.clipboard.writeText(`${window.location.origin}/api/share/${link.token}`)
      toast.success('Link copied to clipboard')
      await handleOpenShare(shareDialog.fileId)
    } catch {
      toast.error('Failed to create share link')
    } finally {
      setCreatingShare(false)
    }
  }

  const handleCopyShare = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/api/share/${token}`)
    toast.success('Share link copied to clipboard')
  }

  const handleRevokeShare = async (linkId: string) => {
    setRevokingShare(linkId)
    try {
      await revokeShareLink(linkId)
      toast.success('Share link revoked')
      if (shareDialog) await handleOpenShare(shareDialog.fileId)
    } catch {
      toast.error('Failed to revoke share link')
    } finally {
      setRevokingShare(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="size-12 rounded-full bg-secondary flex items-center justify-center">
          <FileIcon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No files yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Upload your first file above</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {files.map((file) => {
          return (
          <div
            key={file.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors group"
          >
            <FileTypeIcon mimeType={file.mimeType} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.originalName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatBytes(file.size)} &middot; {formatDate(file.createdAt)}
              </p>
            </div>

            <Badge
              variant={file.isPublic ? 'secondary' : 'outline'}
              className={cn(
                'text-xs shrink-0 gap-1',
                file.isPublic
                  ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950 border-transparent'
                  : ''
              )}
            >
              {file.isPublic ? (
                <Globe className="size-3" />
              ) : (
                <Lock className="size-3" />
              )}
              {file.isPublic ? 'Public' : 'Private'}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="icon" className="size-8 shrink-0">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">File options</span>
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => handleToggle(file.id)}
                  disabled={togglingId === file.id}
                  className="gap-2 cursor-pointer"
                >
                  {file.isPublic ? (
                    <><Lock className="size-3.5" /> Make private</>
                  ) : (
                    <><Globe className="size-3.5" /> Make public</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleOpenShare(file.id)}
                  className="gap-2 cursor-pointer"
                >
                  <Share2 className="size-3.5" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(file.id)}
                  className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )
        })}
      </div>

      <AlertDialog
        open={!!shareDialog?.open}
        onOpenChange={() => { setShareDialog(null); setShareLinksData([]) }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Share file</AlertDialogTitle>
            <AlertDialogDescription>
              Share a direct link or create a share link that works without authentication.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {shareDialog && (() => {
            const file = files.find(f => f.id === shareDialog.fileId)
            if (file) {
              const directUrl = `${window.location.origin}/api/proxy/${file.userId}/${encodeURIComponent(file.originalName)}`
              return (
                <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-secondary/30 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono break-all">{directUrl}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Direct link{file.passwordHash ? ' (password protected)' : ''}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => { navigator.clipboard.writeText(directUrl); toast.success('URL copied to clipboard') }} title="Copy link">
                    <Copy className="size-3" />
                  </Button>
                </div>
              )
            }
            return null
          })()}

          {shareLoaded && shareLinksData.length > 0 && (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Existing links</p>
              {shareLinksData.map((link) => (
                <div key={link.id} className="flex items-center gap-2 p-3 rounded-md border border-border bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono break-all">{window.location.origin}/api/share/{link.token}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {link.downloadCount}/{link.maxDownloads ?? '∞'} downloads
                      {link.expiresAt && ` · expires ${link.expiresAt.toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => handleCopyShare(link.token)} title="Copy link">
                    <Copy className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleRevokeShare(link.id)}
                    disabled={revokingShare === link.id}
                    title="Revoke"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Create new link</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Expires</label>
                <Input
                  type="date"
                  value={shareExpiry}
                  onChange={(e) => setShareExpiry(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Max downloads</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={shareMaxDownloads}
                  onChange={(e) => setShareMaxDownloads(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sharePasswordEnabled}
                onChange={(e) => setSharePasswordEnabled(e.target.checked)}
                className="size-4 accent-foreground"
              />
              <span className="text-xs text-muted-foreground">Password protect</span>
            </label>
            {sharePasswordEnabled && (
              <Input
                type="password"
                placeholder="Enter a password"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateShare}
              disabled={creatingShare}
            >
              {creatingShare ? 'Creating...' : 'Create link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
