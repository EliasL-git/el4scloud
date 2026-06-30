'use client'

import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { resendVerificationEmail } from '@/app/actions/verify'
import { getVerificationStatus } from '@/app/actions/verification'
import { getStorageLimit, getStorageUsage } from '@/app/actions/files'
import { submitStorageRequest } from '@/app/actions/storage'
import { getHackClubAuthUrl } from '@/app/actions/hackclub'
import { exportMyData, requestAccountDeletion, updateName } from '@/app/actions/account'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Trash2, Mail, MailCheck, ShieldCheck, IdCard, Terminal, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { HC_STORAGE_LIMIT } from '@/lib/storage'

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export default function SettingsPage() {
  const { data: session, refetch } = authClient.useSession()
  const [storageLimit, setStorageLimit] = useState(0)
  const [storageUsage, setStorageUsage] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [pickedMethod, setPickedMethod] = useState<'manual' | 'hackclub' | null>(null)
  const [methodStarted, setMethodStarted] = useState<{ type: 'manual' | 'hackclub' } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [linkingHc, setLinkingHc] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [age, setAge] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [requestSlider, setRequestSlider] = useState(5)
  const [requestSending, setRequestSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const emailVerified = session?.user?.emailVerified ?? true
  const userEmail = session?.user?.email ?? ''
  const userName = session?.user?.name ?? ''
  const nameParts = userName.split(' ')
  const defaultFirstName = nameParts[0] ?? ''
  const defaultLastName = nameParts.slice(1).join(' ')

  useEffect(() => {
    const parts = (session?.user?.name ?? '').split(' ')
    setEditFirstName(parts[0] ?? '')
    setEditLastName(parts.slice(1).join(' '))
    getStorageLimit().then(setStorageLimit)
    getStorageUsage().then(setStorageUsage)
    getVerificationStatus().then((s) => {
      if (s.hasPendingRequest) setMethodStarted({ type: 'manual' })
      else if (s.hasHackClubAccount) setMethodStarted({ type: 'hackclub' })
      setLoadingStatus(false)
    })
  }, [])

  // Refetch storage after upgrade
  const refreshStorage = async () => {
    const [limit, usage] = await Promise.all([getStorageLimit(), getStorageUsage()])
    setStorageLimit(limit)
    setStorageUsage(usage)
    refetch()
  }

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

  const handleLinkHackClub = async () => {
    setLinkingHc(true)
    try {
      const { url } = await getHackClubAuthUrl()
      if (url) {
        window.location.href = url
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
    if (!requestReason.trim() || !firstName.trim() || !lastName.trim() || !age.trim()) return
    const ageNum = parseInt(age, 10)
    if (isNaN(ageNum) || ageNum < 1) return
    setRequestSending(true)
    try {
      const amount = `${requestSlider} GB`
      await submitStorageRequest(requestReason.trim(), amount, ageNum, firstName.trim(), lastName.trim())
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

  const handleSaveName = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) return
    setSavingName(true)
    try {
      await updateName(editFirstName.trim(), editLastName.trim())
      refetch()
      toast.success('Name updated')
    } catch {
      toast.error('Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  const handleNameReset = () => {
    const parts = (session?.user?.name ?? '').split(' ')
    setEditFirstName(parts[0] ?? '')
    setEditLastName(parts.slice(1).join(' '))
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
            Profile
          </CardTitle>
          <CardDescription>
            Update your first and last name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-muted-foreground">First name</label>
                <Input
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-muted-foreground">Last name</label>
                <Input
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={savingName || !editFirstName.trim() || !editLastName.trim() || (editFirstName.trim() === defaultFirstName && editLastName.trim() === defaultLastName)}
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                {savingName ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
              </Button>
              {(editFirstName !== defaultFirstName || editLastName !== defaultLastName) && (
                <Button size="sm" variant="ghost" onClick={handleNameReset}>
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
            Pick a verification method to unlock higher storage tiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Usage bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Storage usage</span>
              <span>{formatStorage(storageUsage)} / {formatStorage(storageLimit)}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((storageUsage / (storageLimit || 1)) * 100, 100)}%`,
                  backgroundColor: 'var(--brand)',
                }}
              />
            </div>
          </div>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading...
            </div>
          ) : methodStarted ? (
            /* Method already in progress — show status + ticket note */
            <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                {methodStarted.type === 'manual' ? (
                  <Mail className="size-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Terminal className="size-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {methodStarted.type === 'manual' ? 'Manual verification in progress' : 'Hack Club verification active'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {methodStarted.type === 'manual'
                      ? 'You have a pending storage request. An admin will review it.'
                      : 'Your Hack Club account is linked.'
                    }
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Changed your mind?{' '}
                <a href="/dashboard/support" className="underline underline-offset-2 hover:text-foreground">
                  Open a support ticket
                </a>{' '}
                to request a reset.
              </p>
            </div>
          ) : storageLimit >= HC_STORAGE_LIMIT ? (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <ShieldCheck className="size-3.5 shrink-0" />
              Max tier unlocked — {formatStorage(HC_STORAGE_LIMIT)}
            </div>
          ) : pickedMethod === 'manual' ? (
            /* Manual verification flow */
            !requestSent ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-3">
                  <p className="text-sm font-medium">Verify your identity</p>
                  <p className="text-xs text-muted-foreground">
                    Provide your details and tell us how much storage you need.
                  </p>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">First name</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">Last name</label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">Age</label>
                    <Input
                      type="number"
                      min={1}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="18"
                      className="w-24"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">
                      Requested storage: <span className="font-medium text-foreground">{requestSlider} GB</span>
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
                    disabled={requestSending || !requestReason.trim() || !firstName.trim() || !lastName.trim() || !age.trim()}
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

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setPickedMethod(null); setRequestSent(false) }}
                  className="gap-1.5 w-fit text-xs"
                >
                  &larr; Choose a different method
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  Request submitted — an admin will review it.
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setPickedMethod(null); setRequestSent(false) }}
                  className="gap-1.5 w-fit text-xs"
                >
                  &larr; Choose a different method
                </Button>
              </>
            )
          ) : pickedMethod === 'hackclub' ? (
            /* Hack Club verification flow */
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <Terminal className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Verify with Hack Club for {formatStorage(HC_STORAGE_LIMIT)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Link your Hack Club account to instantly unlock {formatStorage(HC_STORAGE_LIMIT)}.
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
                  Link Hack Club account
                </Button>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPickedMethod(null)}
                className="gap-1.5 w-fit text-xs"
              >
                &larr; Choose a different method
              </Button>
            </div>
          ) : (
            /* Method picker */
            <>
              <p className="text-xs text-muted-foreground">Choose your verification method:</p>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setPickedMethod('manual')}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:border-muted-foreground/30 transition-colors"
                >
                  <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Mail className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">Manual verification</div>
                    <div className="text-xs text-muted-foreground">Provide identity details + admin review</div>
                  </div>
                  <div className="text-xs font-semibold whitespace-nowrap">Up to 25 GB</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPickedMethod('hackclub')}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:border-muted-foreground/30 transition-colors"
                >
                  <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Terminal className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">Hack Club</div>
                    <div className="text-xs text-muted-foreground">Instant verification via Hack Club</div>
                  </div>
                  <div className="text-xs font-semibold whitespace-nowrap">50 GB</div>
                </button>
              </div>

              {storageLimit > 0 && storageLimit < HC_STORAGE_LIMIT && !pickedMethod && (
                <p className="text-xs text-muted-foreground">
                  Changed your mind later?{' '}
                  <a href="/dashboard/support" className="underline underline-offset-2 hover:text-foreground">
                    Open a ticket
                  </a>{' '}
                  and an admin can reset your status.
                </p>
              )}
            </>
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
