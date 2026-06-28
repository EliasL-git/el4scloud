'use client'

import { AlertTriangle, ShieldAlert, X } from 'lucide-react'

interface WarningBannerProps {
  reason?: string
  suspended?: boolean
  onReactivate?: () => void
  onDismiss: () => void
}

export function WarningBanner({ reason, suspended = false, onReactivate, onDismiss }: WarningBannerProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-2.5 text-sm border-b"
      style={{
        backgroundColor: suspended ? 'var(--destructive)' : 'var(--brand)',
        color: suspended ? 'var(--destructive-foreground)' : 'var(--brand-foreground)',
        borderColor: suspended
          ? 'color-mix(in srgb, var(--destructive) 30%, transparent)'
          : 'color-mix(in srgb, var(--brand) 30%, transparent)',
      }}
    >
      {suspended ? (
        <ShieldAlert className="size-4 shrink-0 opacity-80" />
      ) : (
        <AlertTriangle className="size-4 shrink-0 opacity-80" />
      )}
      <span className="flex-1 min-w-0">
        {suspended
          ? 'Your account has been suspended.'
          : 'Your account has been warned.'}
        {reason && <span className="opacity-80 ml-1">— {reason}</span>}
      </span>
      {!suspended && onReactivate && (
        <button
          onClick={onReactivate}
          className="text-xs font-medium underline underline-offset-2 hover:opacity-80 shrink-0 whitespace-nowrap"
        >
          Reactivate
        </button>
      )}
      <button
        onClick={onDismiss}
        className="size-5 flex items-center justify-center rounded hover:bg-black/10 shrink-0"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
