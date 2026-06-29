'use client'

import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { resendVerificationEmail, sendUpgradeCode, verifyUpgradeCode } from '@/app/actions/verify'
import { getStorageLimit } from '@/app/actions/files'
import { submitStorageRequest } from '@/app/actions/storage'
import { exportMyData, requestAccountDeletion } from '@/app/actions/account'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Trash2, Mail, MailCheck, ShieldCheck, IdCard, Terminal, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { MAX_IDENTITY_TIER, HC_STORAGE_LIMIT, NO_VERIFICATION_LIMIT, MANUAL_VERIFICATION_LIMIT } from '@/lib/storage'

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export default function SettingsPage() {
  const { data: session, refetch } = authClient.useSession()
  const [storageLimit, setStorageLimit] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [upgradeCode, setUpgradeCode] = useState('')
  const [upgradeSending, setUpgradeSending] = useState(false)
  const [upgradeVerifying, setUpgradeVerifying] = useState(false)
  const [upgradeSent, setUpgradeSent] = useState(false)
  const [upgraded, setUpgraded] = useState(false)
  const [linkingHc, setLinkingHc] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requestSlider, setRequestSlider] = useState(5)
  const [requestSending, setRequestSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  const emailVerified = session?.user?.emailVerified ?? true
  const userEmail = session?.user?.email ?? ''

  useEffect(() => {
    getStorageLimit().then(setStorageLimit)
  }, [])

  // Refetch storage after upgrade
  const refreshStorage = async () => {
    const limit = await getStorageLimit()
    setStorageLimit(limit)
    refetch()
  }

  const on100MbTier = storageLimit === NO_VERIFICATION_LIMIT
  const canUpgradeTo25Gb = storageLimit > 0 && storageLimit < MANUAL_VERIFICATION_LIMIT
  const canUpgradeTo50Gb = storageLimit < HC_STORAGE_LIMIT
  const canRequestMore = storageLimit >= MANUAL_VERIFICATION_LIMIT && storageLimit < MAX_IDENTITY_TIER

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

  const handleSendUpgradeCode = async () => {
    setUpgradeSending(true)
    setUpgradeSent(false)
    const result = await sendUpgradeCode(userEmail)
    if (result.ok) {
      setUpgradeSent(true)
      toast.success('Verification code sent!')
    } else {
      toast.error(result.error || 'Failed to send code')
    }
    setUpgradeSending(false)
  }

  const handleVerifyUpgradeCode = async () => {
    if (!upgradeCode.trim()) return
    setUpgradeVerifying(true)
    const result = await verifyUpgradeCode(userEmail, upgradeCode.trim())
    if (result.ok) {
      setUpgraded(true)
      toast.success('Identity verified! Storage upgraded to 2.5 GB.')
      await refreshStorage()
    } else {
      toast.error(result.error || 'Invalid code')
    }
    setUpgradeVerifying(false)
  }

  const handleLinkHackClub = async () => {
    setLinkingHc(true)
    try {
      const res = await fetch('/api/auth/oauth2/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'hackclub', callbackURL: '/dashboard/settings' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Failed to start Hack Club verification.')
        setLinkingHc(false)
      }
    } catch {
      toast.error('Failed to start Hack Club verification.')
      setLinkingHc(false)
    }
  }

  const handleSubmitUpgradeRequest = async () => {
    if (!requestReason.trim()) return
    setRequestSending(true)
    try {
      const amount = `${requestSlider} GB`
      await submitStorageRequest(requestReason.trim(), amount)
      setRequestSent(true)
      toast.success('Request submitted for review.')
    } catch {
      toast.error('Failed to submit request.')
    } finally {
      setRequestSending(false)
    }
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
            {canUpgradeTo25Gb
              ? `You are on the ${formatStorage(storageLimit)} tier. Verify your email to upgrade or submit a request for more.`
              : `Your storage allows up to ${formatStorage(MAX_IDENTITY_TIER)}. Submit a request or link Hack Club to unlock more.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Email verification upgrade (100 MB → 2.5 GB) */}
          {on100MbTier && !upgraded && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Verify your email to unlock 2.5 GB</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send a verification code to your email. Once verified, your storage will be upgraded from {formatStorage(NO_VERIFICATION_LIMIT)} to {formatStorage(MANUAL_VERIFICATION_LIMIT)}.
                  </p>
                </div>
              </div>

              {upgradeSent ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <MailCheck className="size-3.5 shrink-0" />
                    Code sent! Check your inbox.
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter 6-digit code"
                      value={upgradeCode}
                      onChange={(e) => setUpgradeCode(e.target.value)}
                      maxLength={6}
                      className="w-40"
                    />
                    <Button
                      size="sm"
                      onClick={handleVerifyUpgradeCode}
                      disabled={upgradeVerifying || upgradeCode.length !== 6}
                    >
                      {upgradeVerifying ? <Loader2 className="size-3.5 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendUpgradeCode}
                  disabled={upgradeSending}
                  className="gap-1.5 w-fit"
                >
                  {upgradeSending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Mail className="size-3.5" />
                  )}
                  Send verification code
                </Button>
              )}
            </div>
          )}

          {upgraded && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <ShieldCheck className="size-3.5 shrink-0" />
              Identity verified — storage upgraded to {formatStorage(MANUAL_VERIFICATION_LIMIT)}
            </div>
          )}

          {/* Request more storage (reason + slider) */}
          {canRequestMore && !requestSent && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Request more storage</p>
                <p className="text-xs text-muted-foreground">
                  Tell us why you need more space and how much you need.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Desired amount: <span className="font-medium text-foreground">{requestSlider} GB</span>
                </label>
                <input
                  type="range"
                  min={2.5}
                  max={25}
                  step={0.5}
                  value={requestSlider}
                  onChange={(e) => setRequestSlider(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-secondary accent-[var(--brand)]"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>2.5 GB</span>
                  <span>25 GB</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">What are you using the app for?</label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Describe your use case and why you need more storage..."
                  rows={3}
                  className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSubmitUpgradeRequest}
                disabled={requestSending || !requestReason.trim()}
                className="gap-1.5 w-fit"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                {requestSending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <IdCard className="size-3.5" />
                )}
                Submit request
              </Button>
            </div>
          )}

          {requestSent && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <ShieldCheck className="size-3.5 shrink-0" />
              Request submitted — an admin will review it.
            </div>
          )}

          {/* Hack Club verification */}
          {canUpgradeTo50Gb && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <Terminal className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Verify with Hack Club for {formatStorage(HC_STORAGE_LIMIT)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Link your Hack Club account to verify your identity and unlock the maximum storage tier.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLinkHackClub}
                disabled={linkingHc}
                className="gap-1.5 w-fit"
              >
                {linkingHc ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Terminal className="size-3.5" />
                )}
                Verify with Hack Club
              </Button>
            </div>
          )}

          {/* Already at max tier */}
          {!canUpgradeTo25Gb && !canUpgradeTo50Gb && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <ShieldCheck className="size-3.5 shrink-0" />
              Max tier unlocked
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
