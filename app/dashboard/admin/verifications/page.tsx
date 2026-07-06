'use client'

import { useState, useEffect, useCallback } from 'react'
import { getVerificationData, getUnverifiedUsers, reachOutToUnverifiedUsers } from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, sectionTitle, formatVerificationMeta } from '../_lib/utils'

export default function AdminVerificationsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getVerificationData>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [reachOutData, setReachOutData] = useState<{ name: string | null; email: string }[] | null>(null)
  const [reachOutLoading, setReachOutLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const vd = await getVerificationData()
    setData(vd)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleReachOut = async () => {
    if (!confirm('Email all currently unverified users with identity verification help?')) return
    setReachOutLoading(true)
    try {
      const result = await reachOutToUnverifiedUsers()
      const u = await getUnverifiedUsers()
      setReachOutData(u)
      if (result.failed > 0) toast.warning(`Sent ${result.sent}/${result.total} emails; ${result.failed} failed`)
      else toast.success(`Reached out to ${result.sent} unverified users`)
    } catch { toast.error('Failed') }
    finally { setReachOutLoading(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          {sectionTitle('Identity verifications')}
          <p className="text-xs text-muted-foreground mt-1">Review Hack Club, manual, email-only, and pending identity verification approvals.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleReachOut} disabled={reachOutLoading}>
          <Mail className="size-3.5" />{reachOutLoading ? 'Sending...' : 'Reach out to all unverified'}
        </Button>
      </div>
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Hack Club</span><p className="text-lg font-semibold">{data.hackclubUsers.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Manual</span><p className="text-lg font-semibold">{data.manualUsers.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Email only</span><p className="text-lg font-semibold">{data.emailUsers.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Pending storage</span><p className="text-lg font-semibold">{data.pendingRequests.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Pending intros</span><p className="text-lg font-semibold">{data.pendingIntros.length}</p></CardContent></Card>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: 'Hack Club verified', rows: data?.hackclubUsers ?? [], badge: 'V Verified (hackclub)' },
          { title: 'Manual verified', rows: data?.manualUsers ?? [], badge: 'V Verified (manual)' },
          { title: 'Email verified only', rows: data?.emailUsers ?? [], badge: 'Email' },
          { title: 'Pending storage approvals', rows: data?.pendingRequests ?? [], badge: 'Pending approval' },
          { title: 'Pending introduction approvals', rows: data?.pendingIntros ?? [], badge: 'Pending intro' },
        ].map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{group.title}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {group.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users.</p>
              ) : (
                group.rows.map((u: any) => (
                  <div key={`${group.title}-${u.id}`} className="rounded-lg border border-border/60 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{group.badge}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(u.createdAt)}</p>
                    {u.introductionText && <p className="mt-2 rounded-md bg-secondary/50 p-2 text-xs whitespace-pre-wrap">{u.introductionText}</p>}
                    {u.verificationMeta && <pre className="mt-2 max-h-24 overflow-auto rounded-md bg-secondary/50 p-2 text-[10px] text-muted-foreground">{formatVerificationMeta(u.verificationMeta)}</pre>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {reachOutData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReachOutData(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-2xl w-full mx-4 p-6 flex flex-col gap-4 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold">Unverified users ({reachOutData.length})</h3>
              <button onClick={() => setReachOutData(null)} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
            </div>
            <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              Hi! we noticed you haven&apos;t verified ur iodentiyy, need help? contact me on slack or email.
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto min-h-0">
              {reachOutData.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">All users are verified!</p> : (
                <div className="text-xs space-y-1">
                  {reachOutData.map((u) => (
                    <div key={u.email} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/30">
                      <span className="font-medium w-32 truncate shrink-0">{u.name ?? '—'}</span>
                      <a href={`mailto:${u.email}`} className="text-muted-foreground hover:text-foreground underline underline-offset-2 truncate">{u.email}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end shrink-0"><Button size="sm" variant="outline" onClick={() => setReachOutData(null)}>Close</Button></div>
          </div>
        </div>
      )}
    </section>
  )
}
