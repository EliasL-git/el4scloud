'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuditLogs } from '@/app/actions/admin'
import { formatDate, sectionTitle } from '../_lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'

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
        <Input placeholder="Filter by user ID..." value={auditFilterUser} onChange={(e) => setAuditFilterUser(e.target.value)} className="w-64" />
        <Input placeholder="Filter by action..." value={auditFilterAction} onChange={(e) => setAuditFilterAction(e.target.value)} className="w-64" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs
            .filter((e) => !auditFilterUser || e.userId?.toLowerCase().includes(auditFilterUser.toLowerCase()))
            .filter((e) => !auditFilterAction || e.action?.toLowerCase().includes(auditFilterAction.toLowerCase()))
            .map((e) => (
              <TableRow key={e.id} className="text-xs">
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(e.createdAt)}</TableCell>
                <TableCell className="font-medium">{e.userId ? `${e.userId.slice(0, 8)}...` : '—'}</TableCell>
                <TableCell><code className="text-xs bg-secondary/50 px-1.5 py-0.5 rounded">{e.action}</code></TableCell>
                <TableCell className="text-muted-foreground max-w-[300px] truncate">{e.details ?? '—'}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </section>
  )
}
