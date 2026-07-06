'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAppeals, approveAppeal, rejectAppeal } from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { statusBadge, sectionTitle } from '../_lib/utils'

type AppealRecord = Awaited<ReturnType<typeof getAppeals>>[number]

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<AppealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [appealNotes, setAppealNotes] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    const ap = await getAppeals()
    setAppeals(ap)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleApprove = async (id: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try { await approveAppeal(id, appealNotes[id] || undefined); toast.success('Appeal approved'); await refresh() }
    catch { toast.error('Failed to approve appeal') }
    finally { setProcessing((p) => ({ ...p, [id]: false })) }
  }

  const handleReject = async (id: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try { await rejectAppeal(id, appealNotes[id] || undefined); toast.success('Appeal rejected'); await refresh() }
    catch { toast.error('Failed to reject appeal') }
    finally { setProcessing((p) => ({ ...p, [id]: false })) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Appeals')}
      {appeals.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No appeals.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {appeals.map(({ appeal, userName, userEmail }) => (
            <Card key={appeal.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{userName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                  </div>
                  <Badge variant={statusBadge[appeal.status]?.variant as any}>{statusBadge[appeal.status]?.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm whitespace-pre-wrap">{appeal.reason}</p>
                {appeal.status === 'pending' && (
                  <div className="flex flex-col gap-2">
                    <input type="text" placeholder="Note (optional)" value={appealNotes[appeal.id] ?? ''} onChange={(e) => setAppealNotes((n) => ({ ...n, [appeal.id]: e.target.value }))} className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5" onClick={() => handleApprove(appeal.id)} disabled={processing[appeal.id]}><Check className="size-3.5" /> Approve</Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40" onClick={() => handleReject(appeal.id)} disabled={processing[appeal.id]}><X className="size-3.5" /> Reject</Button>
                    </div>
                  </div>
                )}
                {appeal.adminNote && <p className="text-xs text-muted-foreground italic">Note: {appeal.adminNote}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
