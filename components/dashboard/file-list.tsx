'use client'

import { useState } from 'react'
import {
  FileIcon,
  FileImageIcon,
  FileVideoIcon,
  FileTextIcon,
  FileArchiveIcon,
  Trash2,
  Link2,
  Globe,
  Lock,
  Copy,
  Check,
  MoreHorizontal,
  LockKeyhole,
  UnlockKeyhole,
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
import { deleteFile, toggleFileVisibility, setFilePassword, removeFilePassword, createShareLink, revokeShareLink, getShareLinks } from '@/app/actions/files'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FileRecord {
  id: string
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [passwordDialog, setPasswordDialog] = useState<{ fileId: string; hasPassword: boolean } | null>(null)
  const [passwordValue, setPasswordValue] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [shareDialog, setShareDialog] = useState<{ fileId: string; open: boolean } | null>(null)
  const [shareLinksData, setShareLinksData] = useState<{ id: string; token: string; expiresAt: Date | null; maxDownloads: number | null; downloadCount: number; createdAt: Date }[]>([])
  const [shareLoaded, setShareLoaded] = useState(false)
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareExpiry, setShareExpiry] = useState('')
  const [shareMaxDownloads, setShareMaxDownloads] = useState('')
  const [revokingShare, setRevokingShare] = useState<string | null>(null)

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('URL copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

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

  const handleSetPassword = async () => {
    if (!passwordDialog || !passwordValue.trim()) return
    if (passwordValue.length < 4) {
      toast.error('Password must be at least 4 characters')
      return
    }
    setSavingPassword(true)
    try {
      await setFilePassword(passwordDialog.fileId, passwordValue)
      onRefresh?.()
      toast.success('Password set')
      setPasswordDialog(null)
      setPasswordValue('')
    } catch {
      toast.error('Failed to set password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleRemovePassword = async (fileId: string) => {
    try {
      await removeFilePassword(fileId)
      onRefresh?.()
      toast.success('Password removed')
    } catch {
      toast.error('Failed to remove password')
    }
  }

  const handleOpenShare = async (fileId: string) => {
    setShareDialog({ fileId, open: true })
    setShareLoaded(false)
    setShareExpiry('')
    setShareMaxDownloads('')
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
      const options: { expiresAt?: Date; maxDownloads?: number } = {}
      if (shareExpiry) options.expiresAt = new Date(shareExpiry)
      if (shareMaxDownloads) options.maxDownloads = parseInt(shareMaxDownloads, 10)
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
          const proxyUrl = `${window.location.origin}/api/proxy/${file.key}`
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

            {file.passwordHash && (
              <Badge variant="outline" className="text-xs shrink-0 gap-1 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900">
                <LockKeyhole className="size-3" />
                Locked
              </Badge>
            )}
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

            {file.isPublic && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => handleCopy(proxyUrl, file.id)}
                title="Copy URL"
              >
                {copiedId === file.id ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            )}

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
                {file.isPublic && (
                  <DropdownMenuItem
                    onClick={() => handleCopy(proxyUrl, file.id)}
                    className="gap-2 cursor-pointer"
                  >
                    <Link2 className="size-3.5" />
                    Copy URL
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => handleOpenShare(file.id)}
                  className="gap-2 cursor-pointer"
                >
                  <Share2 className="size-3.5" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setPasswordDialog({ fileId: file.id, hasPassword: !!file.passwordHash })}
                  className="gap-2 cursor-pointer"
                >
                  {file.passwordHash ? (
                    <><LockKeyhole className="size-3.5" /> Change password</>
                  ) : (
                    <><LockKeyhole className="size-3.5" /> Set password</>
                  )}
                </DropdownMenuItem>
                {file.passwordHash && (
                  <DropdownMenuItem
                    onClick={() => handleRemovePassword(file.id)}
                    className="gap-2 cursor-pointer"
                  >
                    <UnlockKeyhole className="size-3.5" />
                    Remove password
                  </DropdownMenuItem>
                )}
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

      <AlertDialog open={!!passwordDialog} onOpenChange={() => { setPasswordDialog(null); setPasswordValue('') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {passwordDialog?.hasPassword ? 'Change password' : 'Set password'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {passwordDialog?.hasPassword
                ? 'Enter a new password to protect this file.'
                : 'Set a password that must be provided to access this file.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              type="password"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="Enter a password (min 4 characters)"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetPassword() }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSetPassword}
              disabled={savingPassword || passwordValue.length < 4}
            >
              {savingPassword ? 'Saving...' : passwordDialog?.hasPassword ? 'Change' : 'Set'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!shareDialog?.open}
        onOpenChange={() => { setShareDialog(null); setShareLinksData([]) }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Share file</AlertDialogTitle>
            <AlertDialogDescription>
              Create a share link that works without authentication.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {shareLoaded && shareLinksData.length > 0 && (
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Existing links</p>
              {shareLinksData.map((link) => (
                <div key={link.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate">{window.location.origin}/api/share/{link.token}</p>
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
