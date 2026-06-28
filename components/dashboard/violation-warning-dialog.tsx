'use client'

import { useState } from 'react'
import { acknowledgeWarning } from '@/app/actions/warnings'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
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

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AlertDialogContent size="default" className="sm:max-w-[35rem]">
        <AlertDialogHeader>
          <AlertDialogMedia
            style={suspended ? { backgroundColor: 'var(--destructive)' } : { backgroundColor: 'var(--brand)' }}
          >
            {suspended ? (
              <ShieldAlert style={{ color: 'var(--destructive-foreground)' }} />
            ) : (
              <AlertTriangle style={{ color: 'var(--brand-foreground)' }} />
            )}
          </AlertDialogMedia>
          <AlertDialogTitle>
            {suspended ? 'Account Suspended' : 'Content Moderation Notice'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {suspended
              ? 'Repeated Terms of Service Violations'
              : 'Terms of Service Violation'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 px-1">
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3.5 py-2.5">
            <p className="text-sm text-destructive">
              {suspended
                ? 'Your account has been suspended for repeated violations of our terms of service. You can no longer upload files to this platform.'
                : 'This file is not allowed and it\'s treated as a violation of our terms of service. This means your account has been warned.'}
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

          {suspended ? (
            <div className="rounded-lg bg-muted px-3.5 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">
                If you believe this was a mistake, you can{' '}
                <a href="/dashboard/support" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  contact support
                </a>{' '}
                to appeal the decision.
              </p>
            </div>
          ) : (
            <>
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-popover px-3 text-muted-foreground">acknowledge to continue</span>
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
            </>
          )}
        </div>

        <AlertDialogFooter>
          {suspended ? (
            <AlertDialogCancel>I understand</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel
                onClick={() => { setAcknowledged(false); }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReactivate}
                disabled={!acknowledged || loading}
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Reactivating...' : 'Reactivate my account'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
