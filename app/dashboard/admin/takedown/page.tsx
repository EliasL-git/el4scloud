'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTakedownRequests, approveTakedown, rejectTakedown } from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { statusBadge, sectionTitle } from '../_lib/utils'

export default function AdminTakedownPage() {
  const [list, setList] = useState<Awaited<ReturnType<typeof getTakedownRequests>>[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    const td = await getTakedownRequests()
    setList(td)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Takedown Requests')}
      {list.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No takedown requests.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((td) => (
            <Card key={td.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium truncate max-w-[300px]">{td.fileUrl || td.fileId || 'Unknown file'}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Reported by {td.reporterName || td.reporterEmail}</p>
                  </div>
                  <Badge variant={statusBadge[td.status]?.variant as any}>{statusBadge[td.status]?.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div><span className="text-xs text-muted-foreground">Reason</span><p className="mt-0.5">{td.reason}</p></div>
                <div><span className="text-xs text-muted-foreground">Claimant</span><p className="mt-0.5">{td.reporterName || 'Unknown'} &lt;{td.reporterEmail}&gt;</p></div>
                {td.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1.5" disabled={processing[td.id]} onClick={async () => { setProcessing((p) => ({ ...p, [td.id]: true })); try { await approveTakedown(td.id); toast.success('Takedown approved'); await refresh() } catch { toast.error('Failed') } finally { setProcessing((p) => ({ ...p, [td.id]: false })) } }}><Check className="size-3.5" /> Approve</Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40" disabled={processing[td.id]} onClick={async () => { setProcessing((p) => ({ ...p, [td.id]: true })); try { await rejectTakedown(td.id); toast.success('Takedown rejected'); await refresh() } catch { toast.error('Failed') } finally { setProcessing((p) => ({ ...p, [td.id]: false })) } }}><X className="size-3.5" /> Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
