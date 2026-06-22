'use client'

import { useState } from 'react'
import { exportMyData, requestAccountDeletion } from '@/app/actions/account'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

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
