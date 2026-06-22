'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShieldAlert, Send, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

async function getAppeal() {
  const res = await fetch('/api/appeal')
  if (!res.ok) return null
  return res.json() as Promise<{ status: string; adminNote?: string } | null>
}

async function submitAppeal(reason: string) {
  const res = await fetch('/api/appeal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? 'Failed to submit appeal')
  }
}

export function SuspensionBanner({ reason, appealable, suspensionType }: { reason: string; appealable?: boolean; suspensionType?: 'suspended' | 'terminated' }) {
  const [appeal, setAppeal] = useState<{ status: string; adminNote?: string; appealable?: boolean } | null | undefined>(undefined)
  const [appealText, setAppealText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getAppeal().then((res) => setAppeal(res))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!appealText.trim()) return
    setSending(true)
    try {
      await submitAppeal(appealText.trim())
      toast.success('Appeal submitted')
      setAppeal({ status: 'pending' })
    } catch {
      toast.error('Failed to submit appeal')
    } finally {
      setSending(false)
    }
  }

  const canAppeal = appealable ?? appeal?.appealable ?? true
  const pending = appeal?.status === 'pending'
  const approved = appeal?.status === 'approved'
  const rejected = appeal?.status === 'rejected'

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="size-5 text-destructive" />
            </div>
            <div>
              <CardTitle>{suspensionType === 'terminated' ? 'Account Terminated' : 'Account Suspended'}</CardTitle>
              <CardDescription>
                {suspensionType === 'terminated'
                  ? 'Your account has been terminated. Your data will be permanently deleted within 30 days.'
                  : 'Your account has been temporarily suspended'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Reason:</p>
            <p>{reason}</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="size-3.5 text-muted-foreground" />
            <Link href="/dashboard/support" className="text-[var(--brand)] hover:underline">
              Contact support
            </Link>
          </div>

          {approved && (
            <div className="rounded-lg bg-green-100 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-400">
              Your appeal was approved. Your account has been reinstated.
              {appeal?.adminNote && <p className="mt-1 italic">{appeal.adminNote}</p>}
            </div>
          )}

          {rejected && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Your appeal was rejected.
              {appeal?.adminNote && <p className="mt-1 italic">{appeal.adminNote}</p>}
            </div>
          )}

          {!canAppeal && !pending && !approved && !rejected && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Appeals are not allowed for this suspension.
            </div>
          )}

          {appeal === null && canAppeal && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="appeal">Submit an appeal</Label>
                <textarea
                  id="appeal"
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Explain why your account should be reinstated..."
                  rows={4}
                  required
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button type="submit" disabled={sending || !appealText.trim()} className="self-end gap-1.5">
                <Send className="size-3.5" />
                {sending ? 'Sending...' : 'Submit appeal'}
              </Button>
            </form>
          )}

          {pending && (
            <div className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              Your appeal is pending review by an admin.
            </div>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  )
}
