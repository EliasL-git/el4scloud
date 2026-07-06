'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getUsers, lockUser, unlockUser, unsuspendUser, suspendUser, deleteUser,
  resetStorageLimit, resetVerificationStatus, resetIntroduction,
  getUnverifiedUsers, reachOutToUnverifiedUsers, setUserEmailVerified,
} from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RotateCcw, Ban, Unlock, Lock, Trash2, Eye, Mail, CheckCircle2, Terminal, ShieldCheck, Shield, X, Download } from 'lucide-react'
import { toast } from 'sonner'
import { formatBytes, SUSPENSION_REASONS, formatVerificationMeta } from '../_lib/utils'

type UserRecord = Awaited<ReturnType<typeof getUsers>>[number]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [resetModal, setResetModal] = useState<{ userId: string; userName: string } | null>(null)
  const [resetOptions, setResetOptions] = useState({ storage: false, verification: false, introduction: false })
  const [resetSending, setResetSending] = useState(false)
  const [suspendModal, setSuspendModal] = useState<{ userId: string; userName: string } | null>(null)
  const [suspendReason, setSuspendReason] = useState(SUSPENSION_REASONS[0])
  const [suspendCustomReason, setSuspendCustomReason] = useState('')
  const [suspendAppealable, setSuspendAppealable] = useState(true)
  const [suspendType, setSuspendType] = useState<'suspended' | 'terminated'>('suspended')
  const [suspendSending, setSuspendSending] = useState(false)
  const [metaModal, setMetaModal] = useState<{ userId: string; userName: string; meta: Record<string, unknown> } | null>(null)
  const [reachOutData, setReachOutData] = useState<{ name: string | null; email: string }[] | null>(null)
  const [reachOutLoading, setReachOutLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const u = await getUsers()
    setUsers(u)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleAction = async (userId: string, action: string, fn: () => Promise<any>, successMsg: string) => {
    setProcessing((p) => ({ ...p, [`${action}-${userId}`]: true }))
    try { await fn(); toast.success(successMsg); await refresh() }
    catch { toast.error(`Failed: ${successMsg.toLowerCase()}`) }
    finally { setProcessing((p) => ({ ...p, [`${action}-${userId}`]: false })) }
  }

  const handleSuspend = async () => {
    if (!suspendModal) return
    const reason = suspendReason === 'Other' ? suspendCustomReason.trim() : suspendReason
    if (!reason) { toast.error('Enter a reason'); return }
    setSuspendSending(true)
    try {
      await suspendUser(suspendModal.userId, reason, suspendAppealable, suspendType)
      toast.success(suspendType === 'terminated' ? 'User terminated' : 'User suspended')
      setSuspendModal(null)
      await refresh()
    } catch { toast.error('Failed to suspend user') }
    finally { setSuspendSending(false) }
  }

  const handleReachOut = async () => {
    if (!confirm('Email all currently unverified users with identity verification help?')) return
    setReachOutLoading(true)
    try {
      const result = await reachOutToUnverifiedUsers()
      const data = await getUnverifiedUsers()
      setReachOutData(data)
      if (result.failed > 0) toast.warning(`Sent ${result.sent}/${result.total} emails; ${result.failed} failed`)
      else toast.success(`Reached out to ${result.sent} unverified users`)
    } catch { toast.error('Failed to reach out') }
    finally { setReachOutLoading(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Users</h2>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleReachOut} disabled={reachOutLoading}>
          <Mail className="size-3.5" />{reachOutLoading ? 'Sending...' : 'Reach out to unverified'}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-medium">Name</th>
              <th className="text-left py-2 px-3 font-medium">Email</th>
              <th className="text-left py-2 px-3 font-medium">Role</th>
              <th className="text-left py-2 px-3 font-medium">Status</th>
              <th className="text-left py-2 px-3 font-medium">Verified</th>
              <th className="text-left py-2 px-3 font-medium">Storage</th>
              <th className="text-right py-2 px-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-2 px-3 font-medium">{u.name}</td>
                <td className="py-2 px-3 text-muted-foreground">{u.email}</td>
                <td className="py-2 px-3">
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">{u.role}</Badge>
                </td>
                <td className="py-2 px-3">
                  {u.banned ? (
                    <Badge variant="destructive" className="text-xs">{u.suspensionType ?? 'banned'}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-green-500 border-green-500/40">active</Badge>
                  )}
                </td>
                <td className="py-2 px-3">
                  {u.verifiedViaHackclub ? (
                    <Badge variant="outline" className="text-xs gap-1 border-blue-500/40 text-blue-500"><Terminal className="size-3" /> V Verified (hackclub)</Badge>
                  ) : u.verifiedManually ? (
                    <Badge variant="outline" className="text-xs gap-1 border-amber-500/40 text-amber-500"><ShieldCheck className="size-3" /> V Verified (manual)</Badge>
                  ) : u.emailVerified ? (
                    <Badge variant="outline" className="text-xs gap-1 border-green-500/40 text-green-500"><CheckCircle2 className="size-3" /> Email</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs gap-1"><Shield className="size-3" /> None</Badge>
                  )}
                </td>
                <td className="py-2 px-3 text-muted-foreground">{u.storageLimit != null ? formatBytes(u.storageLimit) : 'default'}</td>
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {u.banned ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={processing[`unlock-${u.id}`]} onClick={() => handleAction(u.id, 'unlock', () => unlockUser(u.id), 'User unlocked')}><Unlock className="size-3" /> Unlock</Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" disabled={processing[`lock-${u.id}`]} onClick={() => handleAction(u.id, 'lock', () => lockUser(u.id), 'User locked')}><Lock className="size-3" /> Lock</Button>
                    )}
                    {u.banned ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-green-500" disabled={processing[`unsuspend-${u.id}`]} onClick={() => handleAction(u.id, 'unsuspend', () => unsuspendUser(u.id), 'User unsuspended')}><Unlock className="size-3" /> Unsuspend</Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => setSuspendModal({ userId: u.id, userName: u.name ?? u.email })}><Ban className="size-3" /> Suspend</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setResetOptions({ storage: false, verification: false, introduction: false }); setResetModal({ userId: u.id, userName: u.name ?? u.email }) }}><RotateCcw className="size-3" /> Reset</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { try { setMetaModal({ userId: u.id, userName: u.name ?? u.email, meta: JSON.parse(u.verificationMeta ?? '{}') }) } catch { setMetaModal({ userId: u.id, userName: u.name ?? u.email, meta: { raw: u.verificationMeta ?? '(empty)' } }) }}}><Eye className="size-3" /> Meta</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" asChild><a href={`/api/admin/users/${u.id}/export`}><Download className="size-3" /> Export</a></Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={processing[`delete-${u.id}`]} onClick={() => { if (confirm(`Delete user ${u.name ?? u.email}?`)) handleAction(u.id, 'delete', () => deleteUser(u.id), 'User deleted') }}><Trash2 className="size-3" /> Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResetModal(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-md w-full mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Reset {resetModal.userName}</h3>
            <p className="text-xs text-muted-foreground">Select what to reset:</p>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm cursor-pointer p-2 rounded-md hover:bg-secondary/30">
                <input type="checkbox" checked={resetOptions.storage} onChange={(e) => setResetOptions((o) => ({ ...o, storage: e.target.checked }))} className="size-4 rounded border-input accent-[var(--brand)]" />
                <div><span className="font-medium">Storage limit</span><p className="text-xs text-muted-foreground">Reset to default allocation</p></div>
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer p-2 rounded-md hover:bg-secondary/30">
                <input type="checkbox" checked={resetOptions.verification} onChange={(e) => setResetOptions((o) => ({ ...o, verification: e.target.checked }))} className="size-4 rounded border-input accent-[var(--brand)]" />
                <div><span className="font-medium">Verification status</span><p className="text-xs text-muted-foreground">Clear Hack Club verification & pending requests</p></div>
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer p-2 rounded-md hover:bg-secondary/30">
                <input type="checkbox" checked={resetOptions.introduction} onChange={(e) => setResetOptions((o) => ({ ...o, introduction: e.target.checked }))} className="size-4 rounded border-input accent-[var(--brand)]" />
                <div><span className="font-medium">Introduction status</span><p className="text-xs text-muted-foreground">Clear emailVerified, ban, suspension, intro text</p></div>
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => setResetModal(null)} disabled={resetSending}>Cancel</Button>
              <Button size="sm" className="gap-1.5" disabled={resetSending || (!resetOptions.storage && !resetOptions.verification && !resetOptions.introduction)} onClick={async () => {
                setResetSending(true)
                try {
                  const promises: Promise<any>[] = []
                  if (resetOptions.storage) promises.push(resetStorageLimit(resetModal.userId))
                  if (resetOptions.verification) promises.push(resetVerificationStatus(resetModal.userId))
                  if (resetOptions.introduction) promises.push(resetIntroduction(resetModal.userId))
                  await Promise.all(promises)
                  toast.success('User reset'); setResetModal(null); await refresh()
                } catch { toast.error('Failed to reset user') }
                finally { setResetSending(false) }
              }}>
                <RotateCcw className="size-3.5" />{resetSending ? 'Resetting...' : 'Reset selected'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSuspendModal(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-md w-full mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Suspend {suspendModal.userName}</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Reason</label>
                <select value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} className="h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-sm text-foreground">
                  {SUSPENSION_REASONS.map((r) => (<option key={r} value={r} className="bg-card text-foreground">{r}</option>))}
                </select>
              </div>
              {suspendReason === 'Other' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Custom reason</label>
                  <input type="text" value={suspendCustomReason} onChange={(e) => setSuspendCustomReason(e.target.value)} placeholder="Enter custom reason..." className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="suspendType" value="suspended" checked={suspendType === 'suspended'} onChange={() => setSuspendType('suspended')} className="accent-[var(--brand)]" />
                    <span className={suspendType === 'suspended' ? 'text-foreground font-medium' : 'text-muted-foreground'}>Suspended</span>
                    <span className="text-xs text-muted-foreground">(data stored)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="suspendType" value="terminated" checked={suspendType === 'terminated'} onChange={() => setSuspendType('terminated')} className="accent-destructive" />
                    <span className={suspendType === 'terminated' ? 'text-destructive font-medium' : 'text-muted-foreground'}>Terminated</span>
                    <span className="text-xs text-muted-foreground">(data deleted in 30d)</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="appealable" checked={suspendAppealable} onChange={(e) => setSuspendAppealable(e.target.checked)} className="size-4 rounded border-input accent-[var(--brand)]" />
                <label htmlFor="appealable" className="text-sm text-muted-foreground">Appealable</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setSuspendModal(null)} disabled={suspendSending}>Cancel</Button>
              <Button size="sm" className="gap-1.5" variant="outline" style={{ color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)' }} onClick={handleSuspend} disabled={suspendSending}>
                <Ban className="size-3.5" />{suspendSending ? (suspendType === 'terminated' ? 'Terminating...' : 'Suspending...') : (suspendType === 'terminated' ? 'Terminate' : 'Suspend')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {metaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setMetaModal(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-lg w-full mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Meta — {metaModal.userName}</h3>
              <button onClick={() => setMetaModal(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="size-4" /></button>
            </div>
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {Object.entries(metaModal.meta).length === 0 ? (
                <p className="text-xs text-muted-foreground">No metadata</p>
              ) : (
                Object.entries(metaModal.meta).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 p-2 rounded-md bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">{key}</span>
                    <span className="text-xs font-mono break-all">{typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => setMetaModal(null)}>Close</Button></div>
          </div>
        </div>
      )}

      {reachOutData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReachOutData(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-2xl w-full mx-4 p-6 flex flex-col gap-4 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold">Unverified users ({reachOutData.length})</h3>
              <button onClick={() => setReachOutData(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="size-4" /></button>
            </div>
            <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              Hi! we noticed you haven&apos;t verified ur iodentiyy, need help? contact me on slack (<a href="https://hackclub.enterprise.slack.com/team/U08J9R1TUT1" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground font-medium">slack link</a>) or email me at <a href="mailto:elias.lindholm2010@outlook.com" className="underline underline-offset-2 hover:text-foreground font-medium">elias.lindholm2010@outlook.com</a>
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
