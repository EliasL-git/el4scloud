'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuditLogs } from '@/app/actions/admin'
import { formatDate, sectionTitle } from '../_lib/utils'

type AuditEntry = Awaited<ReturnType<typeof getAuditLogs>>[number]

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [auditFilterUser, setAuditFilterUser] = useState('')
  const [auditFilterAction, setAuditFilterAction] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const al = await getAuditLogs({ limit: 200 })
    setLogs(al)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Audit Log')}
      <div className="flex gap-2">
        <input type="text" placeholder="Filter by user ID..." value={auditFilterUser} onChange={(e) => setAuditFilterUser(e.target.value)} className="h-8 w-64 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <input type="text" placeholder="Filter by action..." value={auditFilterAction} onChange={(e) => setAuditFilterAction(e.target.value)} className="h-8 w-64 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-medium">Date</th>
              <th className="text-left py-2 px-3 font-medium">User</th>
              <th className="text-left py-2 px-3 font-medium">Action</th>
              <th className="text-left py-2 px-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs
              .filter((e) => !auditFilterUser || e.userId?.toLowerCase().includes(auditFilterUser.toLowerCase()))
              .filter((e) => !auditFilterAction || e.action?.toLowerCase().includes(auditFilterAction.toLowerCase()))
              .map((e) => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors text-xs">
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{formatDate(e.createdAt)}</td>
                  <td className="py-2 px-3 font-medium">{e.userId ? `${e.userId.slice(0, 8)}...` : '—'}</td>
                  <td className="py-2 px-3"><code className="text-xs bg-secondary/50 px-1.5 py-0.5 rounded">{e.action}</code></td>
                  <td className="py-2 px-3 text-muted-foreground max-w-[300px] truncate">{e.details ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
