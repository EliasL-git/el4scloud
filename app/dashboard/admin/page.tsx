'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getUsers,
  getRequests,
  approveRequest,
  rejectRequest,
  lockUser,
  unlockUser,
  suspendUser,
  resetStorageLimit,
  setStorageLimit,
  revokePublicFiles,
  resetWarnings,
  setUserEmailVerified,
  resetVerificationStatus,
  deleteUser,
  adminGetTickets,
  adminGetTicketReplies,
  adminReplyToTicket,
  adminCloseTicket,
  adminReopenTicket,
  adminAssignTicket,
  adminUpdatePriority,
  adminUpdateStatus,
  adminGetAdmins,
  adminGetTicketStats,
  getAppeals,
  approveAppeal,
  rejectAppeal,
  searchFiles,
  flagHash,
  getDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
  getAuditLogs,
  getLastCronRun,
  getAccessCodes,
  generateAccessCode,
  revokeAccessCode,
  getTakedownRequests,
  approveTakedown,
  rejectTakedown,
  getScanStats,
  getUserStats,
  getPendingIntroductions,
  approveIntroduction,
  rejectIntroduction,
  resetIntroduction,
} from '@/app/actions/admin'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X, Lock, Unlock, RotateCcw, GlobeOff, Pencil, MessageSquare, Send, ArrowLeft, XCircle, Search, Ban, Download, CheckCircle2, RefreshCw, HardDrive, Users, FileText, Scale, ShieldAlert, Trash2, ClipboardList, Key, LayoutDashboard, Mail, ChevronRight, AlertTriangle, AlertCircle, Info, Tag, Clock, UserCircle, UserPlus, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type UserRecord = Awaited<ReturnType<typeof getUsers>>[number]
type RequestRecord = Awaited<ReturnType<typeof getRequests>>[number]
type AppealRecord = Awaited<ReturnType<typeof getAppeals>>[number]
type DeletionRequestRecord = Awaited<ReturnType<typeof getDeletionRequests>>[number]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const SUSPENSION_REASONS = [
  'Flagged file upload',
  'Terms of service violation',
  'Abusive behavior',
  'Copyright infringement',
  'Spam or phishing',
  'Unauthorized access',
  'Other',
]

type FileResult = Awaited<ReturnType<typeof searchFiles>>

const statusBadge: Record<string, { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

type AuditEntry = Awaited<ReturnType<typeof getAuditLogs>>[number]

type AdminTicket = Awaited<ReturnType<typeof adminGetTickets>>[number]
type AdminReply = Awaited<ReturnType<typeof adminGetTicketReplies>>[number]

export default function AdminPage() {
  const [section, setSection] = useState<string>('overview')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [lastCronRun, setLastCronRun] = useState<AuditEntry | null>(null)
  const [scanStats, setScanStats] = useState<{ avgDuration: number | null; totalScans: number; past24hScans: number } | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({})
  const [customStorage, setCustomStorage] = useState<Record<string, string>>({})
  const [deletionRequestsList, setDeletionRequestsList] = useState<DeletionRequestRecord[]>([])
  const [hashInput, setHashInput] = useState('')
  const [hashSubmitting, setHashSubmitting] = useState(false)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([])
  const [appealsList, setAppealsList] = useState<AppealRecord[]>([])
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [ticketFilter, setTicketFilter] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all')
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('all')
  const [ticketAssignFilter, setTicketAssignFilter] = useState('all')
  const [ticketReplies, setTicketReplies] = useState<AdminReply[]>([])
  const [adminReplyText, setAdminReplyText] = useState('')
  const [adminReplySending, setAdminReplySending] = useState(false)
  const [ticketStats, setTicketStats] = useState<Awaited<ReturnType<typeof adminGetTicketStats>> | null>(null)
  const [adminsList, setAdminsList] = useState<Awaited<ReturnType<typeof adminGetAdmins>>>([])
  const [appealNotes, setAppealNotes] = useState<Record<string, string>>({})
  const [deletionNotes, setDeletionNotes] = useState<Record<string, string>>({})
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [accessCodesList, setAccessCodesList] = useState<Awaited<ReturnType<typeof getAccessCodes>>>([])
  const [takedownList, setTakedownList] = useState<Awaited<ReturnType<typeof getTakedownRequests>>>([])
  const [pendingIntros, setPendingIntros] = useState<Awaited<ReturnType<typeof getPendingIntroductions>>>([])
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(1)
  const [newCodeExpires, setNewCodeExpires] = useState('')
  const [newCodeNote, setNewCodeNote] = useState('')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [auditFilterUser, setAuditFilterUser] = useState('')
  const [auditFilterAction, setAuditFilterAction] = useState('')
  const [fileQuery, setFileQuery] = useState('')
  const [fileResults, setFileResults] = useState<FileResult>([])
  const [fileSearching, setFileSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)
  const [suspendModal, setSuspendModal] = useState<{ userId: string; userName: string } | null>(null)
  const [suspendReason, setSuspendReason] = useState(SUSPENSION_REASONS[0])
  const [suspendCustomReason, setSuspendCustomReason] = useState('')
  const [suspendAppealable, setSuspendAppealable] = useState(true)
  const [suspendType, setSuspendType] = useState<'suspended' | 'terminated'>('suspended')
  const [suspendSending, setSuspendSending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [u, r, t, ap, dr, al, cron, ac, td, ss, us, ts, ad, pi] = await Promise.all([
      getUsers(), getRequests(), adminGetTickets(), getAppeals(), getDeletionRequests(),
      getAuditLogs({ limit: 200 }), getLastCronRun(), getAccessCodes(), getTakedownRequests(),
      getScanStats(), getUserStats(), adminGetTicketStats(), adminGetAdmins(),
      getPendingIntroductions(),
    ])
    setUsers(u)
    setRequests(r)
    setAdminTickets(t)
    setAppealsList(ap)
    setDeletionRequestsList(dr)
    setAuditLogs(al)
    setLastCronRun(cron)
    setAccessCodesList(ac)
    setTakedownList(td)
    setScanStats(ss)
    setUserStats(us)
    setTicketStats(ts)
    setAdminsList(ad)
    setPendingIntros(pi)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Load recent files when Files tab is selected
  useEffect(() => {
    if (section === 'files' && fileResults.length === 0 && !fileSearching) {
      setFileSearching(true)
      searchFiles('').then(setFileResults).finally(() => setFileSearching(false))
    }
  }, [section])

  const handleApprove = async (id: string, defaultAmount: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await approveRequest(id, approvedAmounts[id] || defaultAmount, notes[id] || undefined)
      toast.success('Request approved')
      await refresh()
    } catch {
      toast.error('Failed to approve request')
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleReject = async (id: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await rejectRequest(id, notes[id] || undefined)
      toast.success('Request rejected')
      await refresh()
    } catch {
      toast.error('Failed to reject request')
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }))
    }
  }

  const openTicket = async (ticketId: string) => {
    setSelectedTicket(ticketId)
    const replies = await adminGetTicketReplies(ticketId)
    setTicketReplies(replies)
    setAdminReplyText('')
  }

  const handleAdminReply = async (ticketId: string, isInternal = false) => {
    if (!adminReplyText.trim()) return
    setAdminReplySending(true)
    try {
      await adminReplyToTicket(ticketId, adminReplyText.trim(), isInternal)
      setAdminReplyText('')
      const replies = await adminGetTicketReplies(ticketId)
      setTicketReplies(replies)
      if (isInternal) setAdminReplyText('')
      toast.success(isInternal ? 'Internal note added' : 'Reply sent')
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setAdminReplySending(false)
    }
  }

  const handleAppealApprove = async (id: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await approveAppeal(id, appealNotes[id] || undefined)
      toast.success('Appeal approved')
      await refresh()
    } catch {
      toast.error('Failed to approve appeal')
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleAppealReject = async (id: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await rejectAppeal(id, appealNotes[id] || undefined)
      toast.success('Appeal rejected')
      await refresh()
    } catch {
      toast.error('Failed to reject appeal')
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleFlagHash = async () => {
    if (!hashInput.trim()) return
    setHashSubmitting(true)
    try {
      await flagHash(hashInput.trim())
      toast.success('Hash flagged')
      setHashInput('')
    } catch {
      toast.error('Failed to flag hash (may already exist)')
    } finally {
      setHashSubmitting(false)
    }
  }

  const handleFileSearch = async () => {
    setFileSearching(true)
    try {
      const res = await searchFiles(fileQuery.trim())
      setFileResults(res)
    } catch {
      toast.error('Search failed')
    } finally {
      setFileSearching(false)
    }
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
    } catch {
      toast.error('Failed to suspend user')
    } finally {
      setSuspendSending(false)
    }
  }

  const handleAction = async (userId: string, action: string, fn: () => Promise<any>, successMsg: string) => {
    setProcessing((p) => ({ ...p, [`${action}-${userId}`]: true }))
    try {
      await fn()
      toast.success(successMsg)
      await refresh()
    } catch {
      toast.error(`Failed: ${successMsg.toLowerCase()}`)
    } finally {
      setProcessing((p) => ({ ...p, [`${action}-${userId}`]: false }))
    }
  }

  // Sync section state from URL hash (matches layout sidebar sections)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) setSection(hash)
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '')
      if (h) setSection(h)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    )
  }

  const pendingRequests = requests.filter((r) => r.request.status === 'pending')

  const filteredTickets = adminTickets.filter((t) => {
    if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false
    if (ticketPriorityFilter !== 'all' && t.priority !== ticketPriorityFilter) return false
    if (ticketAssignFilter === 'unassigned' && t.assignedTo) return false
    if (ticketAssignFilter !== 'all' && ticketAssignFilter !== 'unassigned' && ticketAssignFilter !== t.assignedTo) return false
    if (!ticketFilter.trim()) return true
    const q = ticketFilter.toLowerCase()
    return (
      t.subject.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      t.userEmail.toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border-blue-500/20">
              <CardContent className="p-3 flex items-center gap-3 text-sm">
                <RefreshCw className="size-4 shrink-0 text-blue-500" />
                <span className="text-muted-foreground">
                  Scan stats:{' '}
                  {scanStats ? (
                    <span className="text-foreground font-medium">
                      {scanStats.totalScans} total &middot; {scanStats.past24hScans} in 24h
                      {scanStats.avgDuration != null && (
                        <> &middot; avg{' '}{(scanStats.avgDuration / 1000).toFixed(1)}s</>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Loading...</span>
                  )}
                </span>
              </CardContent>
            </Card>

            <Card className="border-green-500/20">
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
                <Card className="border-amber-500/20">
                  <CardContent className="p-3 flex items-center gap-3 text-sm">
                    <MessageSquare className="size-4 shrink-0 text-amber-500" />
                    <span className="text-muted-foreground">
                      Tickets:{' '}
                      <span className="text-foreground font-medium">{ticketStats.total} total</span>
                      {' · '}
                      <span className="text-foreground font-medium">
                        {ticketStats.byStatus['open'] ?? 0} open
                      </span>
                      {' · '}
                      <span className="text-foreground font-medium">
                        {ticketStats.byStatus['in_progress'] ?? 0} in progress
                      </span>
                    </span>
                  </CardContent>
                </Card>
                <Card className="border-red-500/20">
                  <CardContent className="p-3 flex items-center gap-3 text-sm">
                    <AlertTriangle className="size-4 shrink-0 text-red-500" />
                    <span className="text-muted-foreground">
                      Alerts:{' '}
                      {ticketStats.overdue > 0 && (
                        <span className="text-red-500 font-medium">{ticketStats.overdue} overdue SLA</span>
                      )}
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
              <Card>
                <CardContent className="p-3 text-sm">
                  <span className="text-muted-foreground">Users</span>
                  <p className="text-lg font-semibold">{userStats.totalUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-sm">
                  <span className="text-muted-foreground">Files/user</span>
                  <p className="text-lg font-semibold">{userStats.avgFilesPerUser}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-sm">
                  <span className="text-muted-foreground">API keys/user</span>
                  <p className="text-lg font-semibold">{userStats.avgApiKeysPerUser}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-sm">
                  <span className="text-muted-foreground">Tickets/user</span>
                  <p className="text-lg font-semibold">{userStats.avgTicketsPerUser}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-sm">
                  <span className="text-muted-foreground">Storage reqs/user</span>
                  <p className="text-lg font-semibold">{userStats.avgStorageRequestsPerUser}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-sm">
                  <span className="text-muted-foreground">Appeals/user</span>
                  <p className="text-lg font-semibold">{userStats.avgAppealsPerUser}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-sm">
                  <span className="text-muted-foreground">Warnings/user</span>
                  <p className="text-lg font-semibold">{userStats.avgWarningsPerUser}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </section>

      {/* Requests section */}
      {section === 'requests' && (
        <section className="flex flex-col gap-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No pending requests.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingRequests.map(({ request, userName, userEmail }) => (
                <Card key={request.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-medium">{userName}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                      </div>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Name</span>
                        <p className="font-medium">{request.firstName} {request.lastName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Age</span>
                        <p className="font-medium">{request.age}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Requested amount</span>
                        <p className="font-medium">{request.amount}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Submitted</span>
                        <p className="font-medium">{formatDate(request.createdAt)}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Reason</span>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">{request.reason}</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex gap-3">
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-xs text-muted-foreground">Approve amount</label>
                          <input
                            type="text"
                            placeholder={request.amount}
                            value={approvedAmounts[request.id] ?? ''}
                            onChange={(e) =>
                              setApprovedAmounts((a) => ({ ...a, [request.id]: e.target.value }))
                            }
                            className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-xs text-muted-foreground">Note to user</label>
                          <input
                            type="text"
                            placeholder="Optional note"
                            value={notes[request.id] ?? ''}
                            onChange={(e) =>
                              setNotes((n) => ({ ...n, [request.id]: e.target.value }))
                            }
                            className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                          onClick={() => handleApprove(request.id, request.amount)}
                          disabled={processing[request.id]}
                        >
                          <Check className="size-3.5" />
                          {processing[request.id] ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => handleReject(request.id)}
                          disabled={processing[request.id]}
                        >
                          <X className="size-3.5" />
                          {processing[request.id] ? 'Rejecting...' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* History */}
          {requests.filter((r) => r.request.status !== 'pending').length > 0 && (
            <div className="flex flex-col gap-3 pt-4">
              <h3 className="text-sm font-medium text-muted-foreground">History</h3>
              {requests
                .filter((r) => r.request.status !== 'pending')
                .map(({ request, userName, userEmail }) => (
                  <Card key={request.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{userName}</p>
                          <span className="text-xs text-muted-foreground">({userEmail})</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Requested {request.amount}{request.approvedAmount ? ` · Approved: ${request.approvedAmount}` : ''} &middot; {formatDate(request.createdAt)}
                        </p>
                        {request.adminNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {request.adminNote}
                          </p>
                        )}
                      </div>
                      <Badge variant={statusBadge[request.status]?.variant as any}>
                        {statusBadge[request.status]?.label}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </section>
      )}

      {/* Introductions */}
      {section === 'introductions' && (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Users whose AI-verified introduction was rejected. Review their text and approve or reject.
          </p>
          {pendingIntros.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No pending introductions.
              </CardContent>
            </Card>
          ) : (
            pendingIntros.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                      {u.introductionText && (
                        <div className="mt-2 rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                          {u.introductionText}
                        </div>
                      )}
                      {u.suspensionReason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="text-destructive">AI:</span> {u.suspensionReason.replace('AI rejected: ', '')}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(u.createdAt)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={async () => {
                          try {
                            await approveIntroduction(u.id)
                            toast.success('Introduction approved')
                            await refresh()
                          } catch { toast.error('Failed') }
                        }}
                      >
                        <Check className="size-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive border-destructive/40"
                        onClick={async () => {
                          try {
                            await rejectIntroduction(u.id)
                            toast.success('Introduction rejected')
                            await refresh()
                          } catch { toast.error('Failed') }
                        }}
                      >
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSuspendModal(null)}>
          <div className="bg-background rounded-xl shadow-lg max-w-md w-full mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Suspend {suspendModal.userName}</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Reason</label>
                <select
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SUSPENSION_REASONS.map((r) => (
                    <option key={r} value={r} className="bg-card text-foreground">{r}</option>
                  ))}
                </select>
              </div>
              {suspendReason === 'Other' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Custom reason</label>
                  <input
                    type="text"
                    value={suspendCustomReason}
                    onChange={(e) => setSuspendCustomReason(e.target.value)}
                    placeholder="Enter custom reason..."
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="suspendType"
                      value="suspended"
                      checked={suspendType === 'suspended'}
                      onChange={() => setSuspendType('suspended')}
                      className="accent-[var(--brand)]"
                    />
                    <span className={suspendType === 'suspended' ? 'text-foreground font-medium' : 'text-muted-foreground'}>Suspended</span>
                    <span className="text-xs text-muted-foreground">(data stored)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="suspendType"
                      value="terminated"
                      checked={suspendType === 'terminated'}
                      onChange={() => setSuspendType('terminated')}
                      className="accent-destructive"
                    />
                    <span className={suspendType === 'terminated' ? 'text-destructive font-medium' : 'text-muted-foreground'}>Terminated</span>
                    <span className="text-xs text-muted-foreground">(data deleted in 30d)</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="appealable"
                  checked={suspendAppealable}
                  onChange={(e) => setSuspendAppealable(e.target.checked)}
                  className="size-4 rounded border-input accent-[var(--brand)]"
                />
                <label htmlFor="appealable" className="text-sm text-muted-foreground">
                  Appealable
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setSuspendModal(null)} disabled={suspendSending}>
                Cancel
              </Button>
              <Button size="sm" className="gap-1.5" variant="outline" style={suspendType === 'terminated' ? { color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)' } : { color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)' }} onClick={handleSuspend} disabled={suspendSending}>
                <Ban className="size-3.5" />
                {suspendSending ? (suspendType === 'terminated' ? 'Terminating...' : 'Suspending...') : (suspendType === 'terminated' ? 'Terminate' : 'Suspend')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
