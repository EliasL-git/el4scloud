'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLastCronRun, getScanStats, getUserStats, adminGetTicketStats } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { RefreshCw, CheckCircle2, MessageSquare, AlertTriangle } from 'lucide-react'
import { formatDate } from '../_lib/utils'

type AuditEntry = Awaited<ReturnType<typeof getAuditLogs>>[number]

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true)
  const [lastCronRun, setLastCronRun] = useState<AuditEntry | null>(null)
  const [scanStats, setScanStats] = useState<{ avgDuration: number | null; totalScans: number; past24hScans: number } | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [ticketStats, setTicketStats] = useState<Awaited<ReturnType<typeof adminGetTicketStats>> | null>(null)


  const refresh = useCallback(async () => {
    setLoading(true)
    const [cron, ss, us, ts] = await Promise.all([
      getLastCronRun(), getScanStats(), getUserStats(), adminGetTicketStats(),
    ])
    setLastCronRun(cron)
    setScanStats(ss)
    setUserStats(us)
    setTicketStats(ts)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Admin Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <RefreshCw className="size-4 shrink-0 text-blue-500" />
            <span className="text-muted-foreground">
              Scan stats:{' '}
              {scanStats ? (
                <span className="text-foreground font-medium">
                  {scanStats.totalScans} total &middot; {scanStats.past24hScans} in 24h
                  {scanStats.avgDuration != null && (
                    <> &middot; avg {(scanStats.avgDuration / 1000).toFixed(1)}s</>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground italic">Loading...</span>
              )}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-green-500" />
            <span className="text-muted-foreground">
              Last cleanup run:{' '}
              {lastCronRun ? (
                <span className="text-foreground font-medium">
                  {formatDate(lastCronRun.createdAt)}
                  {' — '}
                  {(() => { try { const d = JSON.parse(lastCronRun.details ?? '{}'); return `${d.deleted} user${d.deleted === 1 ? '' : 's'} deleted` } catch { return 'unknown' } })()}
                </span>
              ) : (
                <span className="text-muted-foreground italic">Never run</span>
              )}
            </span>
          </CardContent>
        </Card>
        {ticketStats && (
          <>
            <Card>
              <CardContent className="p-3 flex items-center gap-3 text-sm">
                <MessageSquare className="size-4 shrink-0 text-amber-500" />
                <span className="text-muted-foreground">
                  Tickets:{' '}
                  <span className="text-foreground font-medium">{ticketStats.total} total</span>
                  {' · '}
                  <span className="text-foreground font-medium">{ticketStats.byStatus['open'] ?? 0} open</span>
                  {' · '}
                  <span className="text-foreground font-medium">{ticketStats.byStatus['in_progress'] ?? 0} in progress</span>
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-3 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-red-500" />
                <span className="text-muted-foreground">
                  Alerts:{' '}
                  {ticketStats.overdue > 0 && <span className="text-red-500 font-medium">{ticketStats.overdue} overdue SLA</span>}
                  {ticketStats.overdue > 0 && ticketStats.unassigned > 0 && <span> · </span>}
                  {ticketStats.unassigned > 0 && (
                    <span className="text-amber-500 font-medium">{ticketStats.unassigned} unassigned</span>
                  )}
                  {ticketStats.overdue === 0 && ticketStats.unassigned === 0 && (
                    <span className="text-muted-foreground italic">All clear</span>
                  )}
                </span>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      {userStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Users</span><p className="text-lg font-semibold">{userStats.totalUsers}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Files/user</span><p className="text-lg font-semibold">{userStats.avgFilesPerUser}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">API keys/user</span><p className="text-lg font-semibold">{userStats.avgApiKeysPerUser}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Tickets/user</span><p className="text-lg font-semibold">{userStats.avgTicketsPerUser}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Storage reqs/user</span><p className="text-lg font-semibold">{userStats.avgStorageRequestsPerUser}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Appeals/user</span><p className="text-lg font-semibold">{userStats.avgAppealsPerUser}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-sm"><span className="text-muted-foreground">Warnings/user</span><p className="text-lg font-semibold">{userStats.avgWarningsPerUser}</p></CardContent></Card>
        </div>
      )}
    </section>
  )
}
