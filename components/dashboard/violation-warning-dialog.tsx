'use client'

import { useState } from 'react'
import { acknowledgeWarning } from '@/app/actions/warnings'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ShieldAlert, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ViolationWarningDialogProps {
  open: boolean
  onClose: () => void
  fileName?: string
  reason?: string
  suspended?: boolean
}

export function ViolationWarningDialog({
  open,
  onClose,
  fileName,
  reason,
  suspended = false,
}: ViolationWarningDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReactivate = async () => {
    if (!acknowledged) return
    setLoading(true)
    try {
      await acknowledgeWarning()
      toast.success('Account reactivated')
      setAcknowledged(false)
      onClose()
    } catch {
      toast.error('Failed to reactivate account')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  if (suspended) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-md mx-4 rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--destructive)' }}>
              <ShieldAlert className="size-5" style={{ color: 'var(--destructive-foreground)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Account Suspended</h2>
              <p className="text-xs text-muted-foreground">Repeated Terms of Service Violations</p>
            </div>
          </div>

          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3.5 py-2.5">
            <p className="text-sm text-destructive">
              Your account has been suspended for repeated violations of our terms of service. You can no longer upload files to this platform.
            </p>
          </div>

          {fileName && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-foreground truncate">{fileName}</span>
            </div>
          )}

          {reason && (
            <div className="rounded-lg bg-muted px-3.5 py-2.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Reason:</span> {reason}
              </p>
            </div>
          )}

          <div className="rounded-lg bg-muted px-3.5 py-2.5 text-center">
            <p className="text-xs text-muted-foreground">
              If you believe this was a mistake, you can{' '}
              <a href="/dashboard/support" className="underline underline-offset-2 hover:text-foreground transition-colors">
                contact support
              </a>{' '}
              to appeal the decision.
            </p>
          </div>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            I understand
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (acknowledged) {
            setAcknowledged(false)
            onClose()
          }
        }}
      />
      <div className="relative w-full max-w-md mx-4 rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
            <AlertTriangle className="size-5" style={{ color: 'var(--brand-foreground)' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Content Moderation Notice</h2>
            <p className="text-xs text-muted-foreground">Terms of Service Violation</p>
          </div>
        </div>

        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3.5 py-2.5">
          <p className="text-sm text-destructive">
            This file is not allowed and it&apos;s treated as a violation of our terms of service. This means your account has been warned.
          </p>
        </div>

        {fileName && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-foreground truncate">{fileName}</span>
          </div>
        )}

        {reason && (
          <div className="rounded-lg bg-muted px-3.5 py-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Reason:</span> {reason}
            </p>
          </div>
        )}

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-3 text-muted-foreground">acknowledge to continue</span>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={loading}
            className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground leading-snug select-none">
              I understand and want to reactivate my account
            </span>
            <span className="text-xs text-muted-foreground leading-snug mt-0.5">
              By checking this, you acknowledge the violation and agree to follow our terms going forward.
            </span>
          </div>
        </label>

        <Button
          onClick={handleReactivate}
          disabled={!acknowledged || loading}
          className="w-full gap-2"
          style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'Reactivating...' : 'Reactivate my account'}
        </Button>

        <p className="text-center text-[10px] text-muted-foreground">
          Please review our{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Terms of Service
          </a>{' '}
          to understand what content is permitted.
        </p>
      </div>
    </div>
  )
}
