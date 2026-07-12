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
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scans</p>
                <p className="text-lg font-semibold leading-tight">
                  {scanStats ? `${scanStats.totalScans}` : '...'}
                </p>
                {scanStats && (
                  <p className="text-[11px] text-muted-foreground/70">{scanStats.past24hScans} in 24h</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cleanup</p>
                {lastCronRun ? (
                  <>
                    <p className="text-lg font-semibold leading-tight">{formatDate(lastCronRun.createdAt)}</p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {(() => { try { const d = JSON.parse(lastCronRun.details ?? '{}'); return `${d.deleted} user${d.deleted === 1 ? '' : 's'} deleted` } catch { return 'unknown' } })()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Never run</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {ticketStats && (
          <>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="size-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tickets</p>
                    <p className="text-lg font-semibold leading-tight">{ticketStats.total}</p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {ticketStats.byStatus['open'] ?? 0} open &middot; {ticketStats.byStatus['in_progress'] ?? 0} in progress
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', ticketStats.overdue > 0 ? 'bg-red-500/10' : 'bg-secondary')}>
                    <AlertTriangle className={cn('size-5', ticketStats.overdue > 0 ? 'text-red-500' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Alerts</p>
                    {ticketStats.overdue > 0 || ticketStats.unassigned > 0 ? (
                      <>
                        <p className="text-lg font-semibold leading-tight">
                          {ticketStats.overdue > 0 && <span className="text-red-500">{ticketStats.overdue} overdue</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">
                          {ticketStats.unassigned > 0 && `${ticketStats.unassigned} unassigned`}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">All clear</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      {userStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Users', value: userStats.totalUsers, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Files / user', value: userStats.avgFilesPerUser, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'API keys / user', value: userStats.avgApiKeysPerUser, color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Tickets / user', value: userStats.avgTicketsPerUser, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Storage reqs / user', value: userStats.avgStorageRequestsPerUser, color: 'text-rose-500', bg: 'bg-rose-500/10' },
            { label: 'Appeals / user', value: userStats.avgAppealsPerUser, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
            { label: 'Warnings / user', value: userStats.avgWarningsPerUser, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          ].map(({ label, value, color, bg }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
                  <span className={cn('text-sm font-bold', color)}>{typeof value === 'number' ? Math.round(value * 10) / 10 : value}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold leading-tight">{typeof value === 'number' ? Number.isInteger(value) ? value : value.toFixed(1) : value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
