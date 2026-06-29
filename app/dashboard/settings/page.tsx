'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { resendVerificationEmail } from '@/app/actions/verify'
import { exportMyData, requestAccountDeletion } from '@/app/actions/account'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Trash2, Mail, MailCheck, ShieldCheck, IdCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { MAX_IDENTITY_TIER } from '@/lib/storage'

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export default function SettingsPage() {
  const { data: session } = authClient.useSession()
  const [verifying, setVerifying] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  const emailVerified = session?.user?.emailVerified ?? true
  const userEmail = session?.user?.email ?? ''
  const userStorageLimit = (session?.user as any)?.storageLimit ?? 0
  const needsVerification = userStorageLimit > 0 && userStorageLimit < MAX_IDENTITY_TIER

  const handleResendVerification = async () => {
    setVerifying(true)
    setVerificationSent(false)
    const result = await resendVerificationEmail(userEmail)
    if (result.ok) {
      setVerificationSent(true)
      toast.success('Verification email sent!')
    } else {
      toast.error(result.error || 'Failed to send verification email')
    }
    setVerifying(false)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `el4scloud-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Data exported')
    } catch {
      toast.error('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await requestAccountDeletion(deleteReason.trim() || undefined)
      toast.success('Deletion request submitted. An admin will review it.')
      setConfirmDelete(false)
      setDeleteReason('')
    } catch {
      toast.error('Failed to submit deletion request (may already be pending)')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account and download your data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            {emailVerified ? (
              <ShieldCheck className="size-4 text-green-600" />
            ) : (
              <Mail className="size-4 text-amber-600" />
            )}
            Email verification
          </CardTitle>
          <CardDescription>
            {emailVerified
              ? `${userEmail} is verified.`
              : `${userEmail} is not yet verified. Check your inbox or resend the verification email.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailVerified ? (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <MailCheck className="size-3.5 shrink-0" />
              Verified
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {verificationSent ? (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <MailCheck className="size-3.5 shrink-0" />
                  Verification email sent! Check your inbox.
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResendVerification}
                  disabled={verifying}
                  className="gap-1.5 w-fit"
                >
                  {verifying ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Mail className="size-3.5" />
                  )}
                  Resend verification email
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <IdCard className="size-4 text-muted-foreground" />
            Identity verification
          </CardTitle>
          <CardDescription>
            {needsVerification
              ? `You are on the ${formatStorage(userStorageLimit)} tier. Verify your identity to unlock up to ${formatStorage(MAX_IDENTITY_TIER)}.`
              : `Your storage tier allows up to ${formatStorage(MAX_IDENTITY_TIER)}.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsVerification ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Use the <strong>Need more storage? Apply.</strong> link in the dashboard footer to request a higher limit. An admin will review your request.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <ShieldCheck className="size-3.5 shrink-0" />
              {userStorageLimit >= MAX_IDENTITY_TIER ? 'Max tier unlocked' : 'No upgrade needed'}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export your data</CardTitle>
          <CardDescription>
            Download all your files, API keys, storage requests, support tickets, and profile
            information as a JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5"
            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
          >
            <Download className="size-3.5" />
            {exporting ? 'Exporting...' : 'Download my data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Delete account</CardTitle>
          <CardDescription>
            Request permanent deletion of your account and all associated data.
            An admin will review your request.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {confirmDelete ? (
            <>
              <textarea
                placeholder="Optional reason for deletion..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={2}
                className="min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setConfirmDelete(false); setDeleteReason('') }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  variant="outline"
                  style={{ color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)' }}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-3.5" />
                  {deleting ? 'Submitting...' : 'Confirm deletion request'}
                </Button>
              </div>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 w-fit"
              style={{ color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)' }}
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
              Request account deletion
            </Button>
          )}
        </CardContent>
      </Card>

      <Toaster />
    </div>
  )
}
