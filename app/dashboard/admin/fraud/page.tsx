'use client'

import { useState, useEffect } from 'react'
import { getAllFraudScores, getUserFraudFlags, clearFraudFlags, recalculateFraudScores, suspendFraudUsers } from '@/app/actions/fraud'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, X, Trash2, ShieldAlert, ShieldBan } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, sectionTitle } from '../_lib/utils'
import { fraudRiskLabel } from '@/lib/fraud-labels'

type FraudRow = Awaited<ReturnType<typeof getAllFraudScores>>[0]
type FlagDetail = Awaited<ReturnType<typeof getUserFraudFlags>>[0]

export default function AdminFraudPage() {
  const [rows, setRows] = useState<FraudRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [flags, setFlags] = useState<FlagDetail[]>([])
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    flaggedUsers: { userId: string; name: string; email: string; totalScore: number }[]
  } | null>(null)
  const [suspending, setSuspending] = useState(false)

  const fetchScores = async () => {
    const data = await getAllFraudScores()
    setRows(data)
  }

  useEffect(() => {
    setLoading(true)
    fetchScores().finally(() => setLoading(false))
  }, [])

  const handleScan = async () => {
    setScanning(true)
    try {
      const result = await recalculateFraudScores()
      await fetchScores()
      if (result.flaggedUsers.length > 0) {
        setConfirmModal({ flaggedUsers: result.flaggedUsers })
      } else {
        toast.success('Scan complete — no users flagged for action')
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Scan failed')
    }
    setScanning(false)
  }

  const handleConfirmSuspend = async () => {
    if (!confirmModal) return
    setSuspending(true)
    try {
      const ids = confirmModal.flaggedUsers.map((u) => u.userId)
      const result = await suspendFraudUsers(ids)
      toast.success(`Suspended ${result.suspended} user(s) and sent notification emails`)
      setConfirmModal(null)
      await fetchScores()
    } catch (e: any) {
      toast.error(e?.message ?? 'Suspension failed')
    }
    setSuspending(false)
  }

  const openFlags = async (userId: string, name: string, email: string) => {
    setSelectedUser({ id: userId, name, email })
    setFlagsLoading(true)
    const data = await getUserFraudFlags(userId)
    setFlags(data)
    setFlagsLoading(false)
  }

  const handleClear = async (userId: string) => {
    if (!confirm('Clear all fraud flags for this user? This will also unsuspend if auto-banned.')) return
    setClearing(true)
    try {
      await clearFraudFlags(userId)
      toast.success('Fraud flags cleared')
      setSelectedUser(null)
      await fetchScores()
    } catch { toast.error('Failed to clear flags') }
    finally { setClearing(false) }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {sectionTitle('Fraud Detection')}
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleScan} disabled={scanning}>
          <ShieldAlert className="size-3.5" /> {scanning ? 'Scanning...' : 'Scan all users'}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No fraud flags — all users clean.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-2 px-3 font-medium">User</th>
                <th className="text-left py-2 px-3 font-medium">Score</th>
                <th className="text-left py-2 px-3 font-medium">Flags</th>
                <th className="text-left py-2 px-3 font-medium">Last Flagged</th>
                <th className="text-left py-2 px-3 font-medium">Status</th>
                <th className="text-right py-2 px-3 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const risk = fraudRiskLabel(r.totalScore)
                return (
                  <tr key={r.userId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2 px-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`font-mono text-sm font-bold ${r.totalScore >= 80 ? 'text-destructive' : r.totalScore >= 50 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {r.totalScore}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{r.flagCount}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{r.lastFlagged ? formatDate(new Date(r.lastFlagged)) : '—'}</td>
                    <td className="py-2 px-3"><Badge variant={risk.variant} className="text-xs">{risk.label}</Badge></td>
                    <td className="py-2 px-3 text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openFlags(r.userId, r.name, r.email)}>
                        <Eye className="size-3" /> View
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmModal(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-lg w-full mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldBan className="size-4 text-destructive" />
              Flagged users detected
            </h3>
            <p className="text-sm text-muted-foreground">
              Scan found <strong>{confirmModal.flaggedUsers.length}</strong> user(s) with a fraud score of 50 or higher.
              Do you want to temporarily suspend them and send a notification email?
            </p>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
              {confirmModal.flaggedUsers.map((u) => (
                <div key={u.userId} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                  <div>
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground ml-2">{u.email}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">{u.totalScore}</Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => setConfirmModal(null)} disabled={suspending}>
                No, keep as-is
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleConfirmSuspend} disabled={suspending}>
                <ShieldBan className="size-3.5" /> {suspending ? 'Suspending...' : `Suspend & email ${confirmModal.flaggedUsers.length} user(s)`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Flag detail panel */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/50" onClick={() => setSelectedUser(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-lg w-full mx-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 pb-0">
              <div>
                <h3 className="text-sm font-semibold">{selectedUser.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setSelectedUser(null)}><X className="size-4" /></Button>
            </div>
            <div className="px-4 flex gap-2">
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => handleClear(selectedUser.id)} disabled={clearing}>
                <Trash2 className="size-3.5" /> {clearing ? 'Clearing...' : 'Clear flags & unsuspend'}
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 pt-2 flex flex-col gap-2">
              {flagsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No flags.</p>
              ) : (
                flags.map((f) => {
                  let details: string | null = null
                  try { details = JSON.stringify(JSON.parse(f.details ?? '{}'), null, 2) } catch { details = f.details }
                  return (
                    <div key={f.id} className="rounded-lg border border-border p-3 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium font-mono">{f.signal}</span>
                        <Badge variant="secondary" className="text-xs">+{f.score}</Badge>
                      </div>
                      {details && details !== '{}' && (
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono mt-1">{details}</pre>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
