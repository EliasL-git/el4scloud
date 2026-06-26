'use client'

import { useState } from 'react'
import { acknowledgeWarning } from '@/app/actions/warnings'
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

  // ── Suspended variant (no reactivation) ──
  if (suspended) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div className="relative flex flex-col w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/60 overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

          {/* Header */}
          <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center border-b border-white/5">
            <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-red-600/20 to-rose-500/20 ring-1 ring-red-500/40">
              <svg className="size-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight">
              Account Suspended
            </h2>
            <p className="mt-1 text-xs text-zinc-400 tracking-wide uppercase">
              Repeated Terms of Service Violations
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="rounded-xl bg-red-500/5 border border-red-500/15 px-4 py-3.5">
              <p className="text-sm leading-relaxed text-red-200 font-medium">
                Your account has been suspended for repeated violations of our terms of service. You can no longer upload files to this platform.
              </p>
            </div>

            {fileName && (
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3.5 py-2.5 border border-white/5">
                <svg className="size-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="text-sm text-zinc-300 truncate">{fileName}</span>
              </div>
            )}

            {reason && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-3.5 py-2.5">
                <p className="text-xs text-amber-300/80">
                  <span className="font-medium text-amber-200">Reason:</span> {reason}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
            <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-3 text-center">
              <p className="text-xs text-zinc-400 leading-relaxed">
                If you believe this was a mistake, you can{' '}
                <a href="/dashboard/support" className="text-zinc-200 underline underline-offset-2 hover:text-white transition-colors">
                  contact support
                </a>{' '}
                to appeal the decision.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl py-3 text-sm font-semibold tracking-wide transition-all
                bg-zinc-800 text-zinc-300
                hover:bg-zinc-700 hover:text-white
                active:scale-[0.98] border border-zinc-700/50"
            >
              I understand
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Warning variant (reactivatable) ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (acknowledged) {
            setAcknowledged(false)
            onClose()
          }
        }}
      />

      {/* Modal card */}
      <div className="relative flex flex-col w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/60 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />

        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center border-b border-white/5">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-amber-500/20 ring-1 ring-red-500/30">
            <svg className="size-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">
            Content Moderation Notice
          </h2>
          <p className="mt-1 text-xs text-zinc-400 tracking-wide uppercase">
            Terms of Service Violation
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="rounded-xl bg-red-500/5 border border-red-500/15 px-4 py-3.5">
            <p className="text-sm leading-relaxed text-red-200 font-medium">
              This file is not allowed and it&apos;s treated as a violation of our terms of service. This means your account has been warned.
            </p>
          </div>

          {fileName && (
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3.5 py-2.5 border border-white/5">
              <svg className="size-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className="text-sm text-zinc-300 truncate">{fileName}</span>
            </div>
          )}

          {reason && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-3.5 py-2.5">
              <p className="text-xs text-amber-300/80">
                <span className="font-medium text-amber-200">Reason:</span> {reason}
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#0a0a0f] px-3 text-zinc-600">acknowledge to continue</span>
            </div>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={loading}
                className="peer sr-only"
              />
              <div className="size-4.5 rounded border-2 border-zinc-600 bg-zinc-800/50 transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-500/20 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/50 group-hover:border-zinc-500" />
              {acknowledged && (
                <svg className="absolute inset-0 size-4.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-200 leading-snug select-none">
                I understand and want to reactivate my account
              </span>
              <span className="text-xs text-zinc-500 leading-snug mt-0.5">
                By checking this, you acknowledge the violation and agree to follow our terms going forward.
              </span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleReactivate}
            disabled={!acknowledged || loading}
            className="w-full rounded-xl py-3 text-sm font-semibold tracking-wide transition-all
              disabled:cursor-not-allowed disabled:opacity-30
              enabled:bg-gradient-to-r enabled:from-emerald-600 enabled:to-emerald-500
              enabled:hover:from-emerald-500 enabled:hover:to-emerald-400
              enabled:shadow-lg enabled:shadow-emerald-500/25
              enabled:active:scale-[0.98]"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Reactivating...
              </span>
            ) : (
              'Reactivate my account'
            )}
          </button>

          <p className="mt-3 text-center text-[10px] text-zinc-600 leading-relaxed">
            Please review our{' '}
            <a href="/terms" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200 transition-colors">
              Terms of Service
            </a>{' '}
            to understand what content is permitted.
          </p>
        </div>
      </div>
    </div>
  )
}
