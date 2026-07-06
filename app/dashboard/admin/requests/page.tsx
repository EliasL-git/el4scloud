'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRequests, approveRequest, rejectRequest } from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, statusBadge, sectionTitle } from '../_lib/utils'

type RequestRecord = Awaited<ReturnType<typeof getRequests>>[number]

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    const r = await getRequests()
    setRequests(r)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleApprove = async (id: string, defaultAmount: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await approveRequest(id, approvedAmounts[id] || defaultAmount, notes[id] || undefined)
      toast.success('Request approved')
      await refresh()
    } catch { toast.error('Failed to approve request') }
    finally { setProcessing((p) => ({ ...p, [id]: false })) }
  }

  const handleReject = async (id: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await rejectRequest(id, notes[id] || undefined)
      toast.success('Request rejected')
      await refresh()
    } catch { toast.error('Failed to reject request') }
    finally { setProcessing((p) => ({ ...p, [id]: false })) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  const pendingRequests = requests.filter((r) => r.request.status === 'pending')

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Storage Requests')}
      {pendingRequests.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No pending requests.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pendingRequests.map(({ request, userName, userEmail }) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{userName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-xs text-muted-foreground">Name</span><p className="font-medium">{request.firstName} {request.lastName}</p></div>
                  <div><span className="text-xs text-muted-foreground">Age</span><p className="font-medium">{request.age}</p></div>
                  <div><span className="text-xs text-muted-foreground">Requested</span><p className="font-medium">{request.amount}</p></div>
                  <div><span className="text-xs text-muted-foreground">Submitted</span><p className="font-medium">{formatDate(request.createdAt)}</p></div>
                </div>
                <div><span className="text-xs text-muted-foreground">Reason</span><p className="text-sm mt-0.5 whitespace-pre-wrap">{request.reason}</p></div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs text-muted-foreground">Approve amount</label>
                      <input type="text" placeholder={request.amount} value={approvedAmounts[request.id] ?? ''} onChange={(e) => setApprovedAmounts((a) => ({ ...a, [request.id]: e.target.value }))} className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs text-muted-foreground">Note to user</label>
                      <input type="text" placeholder="Optional note" value={notes[request.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [request.id]: e.target.value }))} className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }} onClick={() => handleApprove(request.id, request.amount)} disabled={processing[request.id]}>
                      <Check className="size-3.5" />{processing[request.id] ? 'Approving...' : 'Approve'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleReject(request.id)} disabled={processing[request.id]}>
                      <X className="size-3.5" />{processing[request.id] ? 'Rejecting...' : 'Reject'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {requests.filter((r) => r.request.status !== 'pending').length > 0 && (
        <div className="flex flex-col gap-3 pt-4">
          <h3 className="text-sm font-medium text-muted-foreground">History</h3>
          {requests.filter((r) => r.request.status !== 'pending').map(({ request, userName, userEmail }) => (
            <Card key={request.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{userName}</p>
                    <span className="text-xs text-muted-foreground">({userEmail})</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Requested {request.amount}{request.approvedAmount ? ` · Approved: ${request.approvedAmount}` : ''} &middot; {formatDate(request.createdAt)}</p>
                  {request.adminNote && <p className="text-xs text-muted-foreground mt-1 italic">Note: {request.adminNote}</p>}
                </div>
                <Badge variant={statusBadge[request.status]?.variant as any}>{statusBadge[request.status]?.label}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
