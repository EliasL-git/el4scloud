'use client'

import { useState, useEffect } from 'react'
import { getWebhookDeliveries, testWebhook } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Webhook, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

interface DeliveryRow {
  id: string
  event: string
  status: string
  responseCode: number | null
  attempt: number
  createdAt: Date
  url: string
  webhookId: string
}

export default function AdminWebhooksPage() {
  const [rows, setRows] = useState<DeliveryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const data = (await getWebhookDeliveries(50, 0)) as DeliveryRow[]
    setRows(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleTest = async (webhookId: string) => {
    setTestingId(webhookId)
    try {
      await testWebhook(webhookId)
      toast.success('Test event dispatched')
      await load()
    } catch {
      toast.error('Failed to test webhook')
    } finally {
      setTestingId(null)
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 dark:text-green-400'
      case 'failed': return 'text-red-600 dark:text-red-400'
      default: return 'text-muted-foreground'
    }
  }

  const seen = new Set<string>()
  const uniqueWebhooks = rows.filter((r) => {
    if (seen.has(r.webhookId)) return false
    seen.add(r.webhookId)
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Webhook className="size-5" />
          Webhook Deliveries
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Recent delivery attempts across all webhooks</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">Event</th>
                <th className="p-3 font-medium">URL</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Response</th>
                <th className="p-3 font-medium">Attempt</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={7}>Loading...</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={7}>No deliveries</td>
                </tr>
              )}
              {!loading && rows.length > 0 && rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3 font-mono text-xs">{r.event}</td>
                  <td className="p-3 max-w-[220px] truncate text-muted-foreground">{r.url}</td>
                  <td className={`p-3 capitalize ${statusColor(r.status)}`}>{r.status}</td>
                  <td className="p-3 tabular-nums">{r.responseCode ?? '-'}</td>
                  <td className="p-3 tabular-nums">{r.attempt}</td>
                  <td className="p-3">
                    {r.webhookId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => handleTest(r.webhookId)}
                        disabled={testingId === r.webhookId}
                      >
                        <Send className="size-3.5" />
                        {testingId === r.webhookId ? 'Testing...' : 'Test'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {uniqueWebhooks.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Webhooks</p>
            <div className="flex flex-col gap-2">
              {uniqueWebhooks.map((w) => (
                <div key={w.webhookId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{w.url}</p>
                    <p className="text-xs text-muted-foreground">ID: {w.webhookId}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs shrink-0"
                    onClick={() => handleTest(w.webhookId)}
                    disabled={testingId === w.webhookId}
                  >
                    <Send className="size-3.5" />
                    {testingId === w.webhookId ? 'Testing...' : 'Test webhook'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  )
}
