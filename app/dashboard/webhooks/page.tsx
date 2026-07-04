'use client'

import { useState, useEffect } from 'react'
import { getMyWebhooks, createMyWebhook, deleteMyWebhook, testMyWebhook } from '@/app/actions/webhooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { Webhook, Plus, Trash2, Copy, Check, RefreshCw, Send, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type Webhook = Awaited<ReturnType<typeof getMyWebhooks>>[number]

const AVAILABLE_EVENTS = [
  { id: 'file.uploaded', label: 'File uploaded' },
  { id: 'file.scanned', label: 'File scanned' },
  { id: 'file.flagged', label: 'File flagged' },
  { id: 'file.deleted', label: 'File deleted' },
  { id: 'file.visibility_changed', label: 'File visibility changed' },
  { id: 'share_link.created', label: 'Share link created' },
  { id: 'share_link.revoked', label: 'Share link revoked' },
  { id: 'ticket.created', label: 'Ticket created' },
  { id: 'ticket.replied', label: 'Ticket replied' },
  { id: 'ticket.closed', label: 'Ticket closed' },
  { id: 'ticket.reopened', label: 'Ticket reopened' },
  { id: 'user.signed_up', label: 'User signed up' },
  { id: 'user.suspended', label: 'User suspended' },
  { id: 'user.terminated', label: 'User terminated' },
  { id: 'user.deleted', label: 'User deleted' },
  { id: 'user.warning_acknowledged', label: 'Warning acknowledged' },
  { id: 'user.appeal_approved', label: 'Appeal approved' },
  { id: 'user.appeal_rejected', label: 'Appeal rejected' },
  { id: 'storage.request_approved', label: 'Storage request approved' },
  { id: 'storage.request_rejected', label: 'Storage request rejected' },
  { id: 'deletion.request_approved', label: 'Deletion request approved' },
  { id: 'deletion.request_rejected', label: 'Deletion request rejected' },
  { id: 'admin.hash_flagged', label: 'Hash flagged' },
  { id: 'admin.takedown_approved', label: 'Takedown approved' },
  { id: 'ai.daily_limit_warning', label: 'AI daily limit warning' },
  { id: 'ai.daily_limit_exceeded', label: 'AI daily limit exceeded' },
  { id: 'api.key.created', label: 'API key created' },
  { id: 'api.key.deleted', label: 'API key deleted' },
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [newSecretPrefix, setNewSecretPrefix] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  const refresh = async () => {
    const data = await getMyWebhooks()
    setWebhooks(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || selectedEvents.length === 0) {
      toast.error('URL and at least one event are required')
      return
    }

    setCreating(true)
    try {
      const result = await createMyWebhook(url, selectedEvents)
      setNewSecretPrefix(result.secretPrefix)
      setUrl('')
      setSelectedEvents([])
      await refresh()
      toast.success('Webhook created')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create webhook')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (webhookId: string) => {
    setDeleting(true)
    try {
      await deleteMyWebhook(webhookId)
      await refresh()
      toast.success('Webhook deleted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete webhook')
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  const handleTest = async (webhookId: string) => {
    setTestingId(webhookId)
    try {
      await testMyWebhook(webhookId)
      toast.success('Test event sent')
    } catch (err: any) {
      toast.error(err.message || 'Failed to test webhook')
    } finally {
      setTestingId(null)
    }
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    )
  }

  const copySecretPrefix = () => {
    if (newSecretPrefix) {
      navigator.clipboard.writeText(newSecretPrefix)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Webhook className="size-5" />
          Webhooks
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Receive HTTP notifications when events happen in your account
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0 mt-0.5 text-blue-500" />
          <span>
            Webhooks use <strong className="text-foreground">Discord embed format</strong>. They work best with Discord webhook URLs and may not be compatible with all providers.
          </span>
        </div>
      </div>

      {newSecretPrefix && (
        <Card className="border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-1">Secret prefix: {newSecretPrefix}</p>
            <p className="text-xs text-muted-foreground mb-2">
              Save this now — the full secret will not be shown again.
            </p>
            <Button size="sm" variant="outline" onClick={copySecretPrefix} className="gap-1.5 text-xs">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy prefix'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create webhook</CardTitle>
          <CardDescription>Send account events to an HTTPS endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="url">Endpoint URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Events</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => {
                    if (selectedEvents.length === AVAILABLE_EVENTS.length) {
                      setSelectedEvents([])
                    } else {
                      setSelectedEvents(AVAILABLE_EVENTS.map((e) => e.id))
                    }
                  }}
                >
                  {selectedEvents.length === AVAILABLE_EVENTS.length ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_EVENTS.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => toggleEvent(event.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                      selectedEvents.includes(event.id)
                        ? 'border-foreground/40 bg-secondary'
                        : 'border-border hover:bg-secondary/50'
                    }`}
                  >
                    {event.label}
                  </button>
                ))}
              </div>
              {selectedEvents.length === 0 && (
                <p className="text-xs text-muted-foreground">Select at least one event</p>
              )}
            </div>

            <Button type="submit" disabled={creating || !url.trim() || selectedEvents.length === 0} className="gap-1.5">
              <Plus className="size-4" />
              {creating ? 'Creating...' : 'Create webhook'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your webhooks</CardTitle>
          <CardDescription>{webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No webhooks yet. Create one above to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((hook) => (
                <div key={hook.id} className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{hook.url}</p>
                      <Badge variant={hook.active ? 'outline' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {hook.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Secret prefix: {hook.secretPrefix ?? '—'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        try {
                          const events = JSON.parse(hook.events) as string[]
                          return events.map((e) => (
                            <Badge key={e} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {e}
                            </Badge>
                          ))
                        } catch {
                          return null
                        }
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {formatDate(hook.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 h-7 text-xs shrink-0"
                    onClick={() => handleTest(hook.id)}
                    disabled={testingId === hook.id || !hook.active}
                  >
                    <Send className="size-3.5" />
                    {testingId === hook.id ? 'Sending...' : 'Test'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 h-7 text-xs text-destructive shrink-0"
                    onClick={() => setConfirmDelete(hook.id)}
                    disabled={deleting}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this webhook and its delivery history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  )
}
