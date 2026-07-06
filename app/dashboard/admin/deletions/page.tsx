'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDeletionRequests, approveDeletionRequest, rejectDeletionRequest } from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, statusBadge, sectionTitle } from '../_lib/utils'

type DeletionRequestRecord = Awaited<ReturnType<typeof getDeletionRequests>>[number]

export default function AdminDeletionsPage() {
  const [deletions, setDeletions] = useState<DeletionRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [deletionNotes, setDeletionNotes] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    const dr = await getDeletionRequests()
    setDeletions(dr)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Deletion Requests')}
      {deletions.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No deletion requests.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {deletions.map(({ request: dr, userName, userEmail }) => (
            <Card key={dr.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{userName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                  </div>
                  <Badge variant={statusBadge[dr.status]?.variant as any}>{statusBadge[dr.status]?.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Requested {formatDate(dr.createdAt)}</p>
                {dr.reason && <p className="text-sm whitespace-pre-wrap">{dr.reason}</p>}
                {dr.status === 'pending' && (
                  <div className="flex flex-col gap-2">
                    <input type="text" placeholder="Note (optional)" value={deletionNotes[dr.id] ?? ''} onChange={(e) => setDeletionNotes((n) => ({ ...n, [dr.id]: e.target.value }))} className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5" disabled={processing[dr.id]} onClick={async () => { setProcessing((p) => ({ ...p, [dr.id]: true })); try { await approveDeletionRequest(dr.id, deletionNotes[dr.id] || undefined); toast.success('Deletion approved'); await refresh() } catch { toast.error('Failed') } finally { setProcessing((p) => ({ ...p, [dr.id]: false })) } }}><Check className="size-3.5" /> Approve</Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40" disabled={processing[dr.id]} onClick={async () => { setProcessing((p) => ({ ...p, [dr.id]: true })); try { await rejectDeletionRequest(dr.id, deletionNotes[dr.id] || undefined); toast.success('Deletion rejected'); await refresh() } catch { toast.error('Failed') } finally { setProcessing((p) => ({ ...p, [dr.id]: false })) } }}><X className="size-3.5" /> Reject</Button>
                    </div>
                  </div>
                )}
                {dr.adminNote && <p className="text-xs text-muted-foreground italic">Note: {dr.adminNote}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
