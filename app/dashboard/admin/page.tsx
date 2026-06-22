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
  adminGetTickets,
  adminGetTicketReplies,
  adminReplyToTicket,
  adminCloseTicket,
  adminReopenTicket,
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
} from '@/app/actions/admin'
import {
  getCreditRequests,
  approveCreditRequest,
  rejectCreditRequest,
  issueCredits,
} from '@/app/actions/credits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X, Lock, Unlock, RotateCcw, GlobeOff, Pencil, MessageSquare, Send, ArrowLeft, XCircle, Coins, Search, Ban, Download, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type UserRecord = Awaited<ReturnType<typeof getUsers>>[number]
type RequestRecord = Awaited<ReturnType<typeof getRequests>>[number]
type CreditRequestRecord = Awaited<ReturnType<typeof getCreditRequests>>[number]
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
type Tab = 'requests' | 'credits' | 'users' | 'tickets' | 'appeals' | 'files' | 'deletions' | 'audit'

type AdminTicket = Awaited<ReturnType<typeof adminGetTickets>>[number]
type AdminReply = Awaited<ReturnType<typeof adminGetTicketReplies>>[number]

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('requests')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [creditRequests, setCreditRequests] = useState<CreditRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [lastCronRun, setLastCronRun] = useState<AuditEntry | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({})
  const [creditApprovedAmounts, setCreditApprovedAmounts] = useState<Record<string, string>>({})
  const [creditNotes, setCreditNotes] = useState<Record<string, string>>({})
  const [issueCreditAmounts, setIssueCreditAmounts] = useState<Record<string, string>>({})
  const [customStorage, setCustomStorage] = useState<Record<string, string>>({})
  const [deletionRequestsList, setDeletionRequestsList] = useState<DeletionRequestRecord[]>([])
  const [hashInput, setHashInput] = useState('')
  const [hashSubmitting, setHashSubmitting] = useState(false)
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([])
  const [appealsList, setAppealsList] = useState<AppealRecord[]>([])
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [ticketReplies, setTicketReplies] = useState<AdminReply[]>([])
  const [adminReplyText, setAdminReplyText] = useState('')
  const [adminReplySending, setAdminReplySending] = useState(false)
  const [appealNotes, setAppealNotes] = useState<Record<string, string>>({})
  const [deletionNotes, setDeletionNotes] = useState<Record<string, string>>({})
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [auditFilterUser, setAuditFilterUser] = useState('')
  const [auditFilterAction, setAuditFilterAction] = useState('')
  const [fileQuery, setFileQuery] = useState('')
  const [fileResults, setFileResults] = useState<FileResult>([])
  const [fileSearching, setFileSearching] = useState(false)
  const [suspendModal, setSuspendModal] = useState<{ userId: string; userName: string } | null>(null)
  const [suspendReason, setSuspendReason] = useState(SUSPENSION_REASONS[0])
  const [suspendCustomReason, setSuspendCustomReason] = useState('')
  const [suspendAppealable, setSuspendAppealable] = useState(true)
  const [suspendType, setSuspendType] = useState<'suspended' | 'terminated'>('suspended')
  const [suspendSending, setSuspendSending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [u, r, t, cr, ap, dr, al, cron] = await Promise.all([getUsers(), getRequests(), adminGetTickets(), getCreditRequests(), getAppeals(), getDeletionRequests(), getAuditLogs({ limit: 200 }), getLastCronRun()])
    setUsers(u)
    setRequests(r)
    setAdminTickets(t)
    setCreditRequests(cr)
    setAppealsList(ap)
    setDeletionRequestsList(dr)
    setAuditLogs(al)
    setLastCronRun(cron)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreditApprove = async (id: string, defaultAmount: number) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await approveCreditRequest(id, parseFloat(creditApprovedAmounts[id]) || defaultAmount, creditNotes[id] || undefined)
      toast.success('Credit request approved')
      await refresh()
    } catch {
      toast.error('Failed to approve credit request')
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleCreditReject = async (id: string) => {
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      await rejectCreditRequest(id, creditNotes[id] || undefined)
      toast.success('Credit request rejected')
      await refresh()
    } catch {
      toast.error('Failed to reject credit request')
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleIssueCredits = async (userId: string) => {
    const amount = parseFloat(issueCreditAmounts[userId])
    if (!amount || amount <= 0) return
    setProcessing((p) => ({ ...p, [`issue-${userId}`]: true }))
    try {
      await issueCredits(userId, amount)
      toast.success(`Issued ${amount} credits`)
      setIssueCreditAmounts((s) => ({ ...s, [userId]: '' }))
      await refresh()
    } catch {
      toast.error('Failed to issue credits')
    } finally {
      setProcessing((p) => ({ ...p, [`issue-${userId}`]: false }))
    }
  }

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

  const handleAdminReply = async (ticketId: string) => {
    if (!adminReplyText.trim()) return
    setAdminReplySending(true)
    try {
      await adminReplyToTicket(ticketId, adminReplyText.trim())
      setAdminReplyText('')
      const replies = await adminGetTicketReplies(ticketId)
      setTicketReplies(replies)
      toast.success('Reply sent')
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
    if (!fileQuery.trim()) { setFileResults([]); return }
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
  const pendingCreditRequests = creditRequests.filter((r) => r.request.status === 'pending')

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage users, files, and system operations.
        </p>
      </div>

      {/* Cron status */}
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('requests')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'requests'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Storage Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </button>
        <button
          onClick={() => setTab('credits')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'credits'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Credit Requests {pendingCreditRequests.length > 0 && `(${pendingCreditRequests.length})`}
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'users'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Users ({users.length})
        </button>
        <button
          onClick={() => { setTab('tickets'); setSelectedTicket(null) }}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'tickets'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Tickets ({adminTickets.length})
        </button>
        <button
          onClick={() => setTab('appeals')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'appeals'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Appeals {appealsList.filter((a) => a.appeal.status === 'pending').length > 0 && `(${appealsList.filter((a) => a.appeal.status === 'pending').length})`}
        </button>
        <button
          onClick={() => setTab('files')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'files'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setTab('deletions')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'deletions'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Deletion Requests {deletionRequestsList.filter((d) => d.request.status === 'pending').length > 0 && `(${deletionRequestsList.filter((d) => d.request.status === 'pending').length})`}
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            tab === 'audit'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Audit Log
        </button>
      </div>

      {/* Requests tab */}
      {tab === 'requests' && (
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

      {/* Credit Requests tab */}
      {tab === 'credits' && (
        <section className="flex flex-col gap-4">
          {pendingCreditRequests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No pending credit requests.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingCreditRequests.map(({ request, userName, userEmail }) => (
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
                        <span className="text-xs text-muted-foreground">Requested credits</span>
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
                            type="number"
                            step="any"
                            min="1"
                            placeholder={String(request.amount)}
                            value={creditApprovedAmounts[request.id] ?? ''}
                            onChange={(e) =>
                              setCreditApprovedAmounts((a) => ({ ...a, [request.id]: e.target.value }))
                            }
                            className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-xs text-muted-foreground">Note to user</label>
                          <input
                            type="text"
                            placeholder="Optional note"
                            value={creditNotes[request.id] ?? ''}
                            onChange={(e) =>
                              setCreditNotes((n) => ({ ...n, [request.id]: e.target.value }))
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
                          onClick={() => handleCreditApprove(request.id, request.amount)}
                          disabled={processing[request.id]}
                        >
                          <Check className="size-3.5" />
                          {processing[request.id] ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => handleCreditReject(request.id)}
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
          {creditRequests.filter((r) => r.request.status !== 'pending').length > 0 && (
            <div className="flex flex-col gap-3 pt-4">
              <h3 className="text-sm font-medium text-muted-foreground">History</h3>
              {creditRequests
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
                          Requested {request.amount} credits &middot; {formatDate(request.createdAt)}
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

      {/* Appeals tab */}
      {tab === 'appeals' && (
        <section className="flex flex-col gap-3">
          {appealsList.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No appeals yet.
              </CardContent>
            </Card>
          ) : (
            appealsList.map(({ appeal, userName, userEmail }) => (
              <Card key={appeal.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{userName}</p>
                        <span className="text-xs text-muted-foreground">({userEmail})</span>
                        <Badge variant={statusBadge[appeal.status]?.variant as any}>
                          {statusBadge[appeal.status]?.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(appeal.createdAt)}</p>
                      <p className="text-sm mt-2 whitespace-pre-wrap">{appeal.reason}</p>
                      {appeal.adminNote && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Note: {appeal.adminNote}
                        </p>
                      )}
                    </div>
                    {appeal.status === 'pending' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Note"
                            value={appealNotes[appeal.id] ?? ''}
                            onChange={(e) =>
                              setAppealNotes((n) => ({ ...n, [appeal.id]: e.target.value }))
                            }
                            className="h-8 w-28 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5"
                            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                            onClick={() => handleAppealApprove(appeal.id)}
                            disabled={processing[appeal.id]}
                          >
                            <Check className="size-3.5" />
                            {processing[appeal.id] ? '...' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={() => handleAppealReject(appeal.id)}
                            disabled={processing[appeal.id]}
                          >
                            <X className="size-3.5" />
                            {processing[appeal.id] ? '...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}

      {/* Deletion Requests tab */}
      {tab === 'deletions' && (
        <section className="flex flex-col gap-3">
          {deletionRequestsList.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No deletion requests.
              </CardContent>
            </Card>
          ) : (
            deletionRequestsList.map(({ request, userName, userEmail }) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{userName}</p>
                        <span className="text-xs text-muted-foreground">({userEmail})</span>
                        <Badge variant={statusBadge[request.status]?.variant as any}>
                          {statusBadge[request.status]?.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(request.createdAt)}</p>
                      {request.reason && (
                        <p className="text-sm mt-2 whitespace-pre-wrap">{request.reason}</p>
                      )}
                      {request.adminNote && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Note: {request.adminNote}</p>
                      )}
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Note"
                            value={deletionNotes[request.id] ?? ''}
                            onChange={(e) =>
                              setDeletionNotes((n) => ({ ...n, [request.id]: e.target.value }))
                            }
                            className="h-8 w-28 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5"
                            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                            onClick={async () => { await approveDeletionRequest(request.id, deletionNotes[request.id] || undefined); toast.success('Deletion approved'); await refresh() }}
                            disabled={processing[request.id]}
                          >
                            {processing[request.id] ? '...' : 'Approve & delete'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={async () => { await rejectDeletionRequest(request.id, deletionNotes[request.id] || undefined); toast.success('Deletion rejected'); await refresh() }}
                            disabled={processing[request.id]}
                          >
                            {processing[request.id] ? '...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}

      {/* Audit Log tab */}
      {tab === 'audit' && (
        <section className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Filter by user ID..."
              value={auditFilterUser}
              onChange={(e) => setAuditFilterUser(e.target.value)}
              className="h-8 w-48 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="text"
              placeholder="Filter by action..."
              value={auditFilterAction}
              onChange={(e) => setAuditFilterAction(e.target.value)}
              className="h-8 w-48 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                const res = await getAuditLogs({ userId: auditFilterUser || undefined, action: auditFilterAction || undefined, limit: 200 })
                setAuditLogs(res)
              }}
            >
              <Search className="size-3.5" />
              Filter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                const header = 'ID,User ID,Action,Details,IP,User Agent,Created At'
                const rows = auditLogs.map((e) =>
                  [e.id, e.userId, e.action, `"${(e.details ?? '').replace(/"/g, '""')}"`, e.ipAddress ?? '', `"${(e.userAgent ?? '').replace(/"/g, '""')}"`, e.createdAt.toISOString()].join(',')
                )
                const csv = [header, ...rows].join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
              disabled={auditLogs.length === 0}
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {auditLogs.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-3 flex items-start gap-3 text-xs">
                  <div className="min-w-0 flex-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <span className="text-muted-foreground">Action:</span>
                    <span className="font-mono">{entry.action}</span>
                    <span className="text-muted-foreground">User:</span>
                    <span className="font-mono truncate">{entry.userId}</span>
                    <span className="text-muted-foreground">IP:</span>
                    <span className="font-mono">{entry.ipAddress ?? '-'}</span>
                    <span className="text-muted-foreground">Date:</span>
                    <span>{formatDate(entry.createdAt)}</span>
                    {entry.details && (
                      <>
                        <span className="text-muted-foreground">Details:</span>
                        <span className="text-muted-foreground truncate">{entry.details}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {auditLogs.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No audit log entries.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Files tab */}
      {tab === 'files' && (
        <section className="flex flex-col gap-3">
          {/* Flag hash */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <input
                type="text"
                placeholder="Paste a hash to flag..."
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFlagHash()}
                className="flex-1 h-8 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
              />
              <Button size="sm" className="gap-1.5 shrink-0" onClick={handleFlagHash} disabled={hashSubmitting || !hashInput.trim()}>
                <Ban className="size-3.5" />
                {hashSubmitting ? 'Flagging...' : 'Flag hash'}
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search files by name..."
              value={fileQuery}
              onChange={(e) => setFileQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFileSearch()}
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button size="sm" className="gap-1.5" onClick={handleFileSearch} disabled={fileSearching}>
              <Search className="size-3.5" />
              {fileSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
          {fileResults.length === 0 && fileQuery && !fileSearching && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No files found matching "{fileQuery}".
              </CardContent>
            </Card>
          )}
          {fileResults.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{f.originalName}</p>
                      {f.isPublic && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Public</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.userName} ({f.userEmail}) &middot; {formatBytes(f.size)} &middot; {formatDate(f.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{f.name}</p>
                  </div>
                  <Badge variant="outline">{f.mimeType}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {!fileQuery && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Enter a file name to search.
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Tickets tab */}
      {tab === 'tickets' && (
        <section className="flex flex-col gap-3">
          {selectedTicket ? (
            <>
              <button
                onClick={() => setSelectedTicket(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
              >
                <ArrowLeft className="size-3.5" />
                Back to all tickets
              </button>

              {(() => {
                const t = adminTickets.find((x) => x.id === selectedTicket)
                if (!t) return null
                const all = [
                  { id: t.id, message: t.message, createdAt: t.createdAt, userId: t.userId, userName: t.userName, userRole: 'user' as const },
                  ...ticketReplies,
                ]
                return (
                  <div className="flex flex-col gap-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm font-medium">{t.subject}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.userName} &middot; {formatDate(t.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={t.status === 'open' ? 'secondary' : 'outline'}>
                              {t.status === 'open' ? 'Open' : 'Closed'}
                            </Badge>
                            {t.status === 'open' ? (
                              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={async () => { await adminCloseTicket(t.id); await refresh(); setSelectedTicket(null); toast.success('Ticket closed') }}>
                                <XCircle className="size-3" /> Close
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={async () => { await adminReopenTicket(t.id); await refresh(); openTicket(t.id); toast.success('Ticket reopened') }}>
                                Reopen
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>

                    {all.map((msg, i) => (
                      <div key={msg.id} className={`flex ${msg.userRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.userRole === 'admin' ? 'text-primary-foreground' : 'bg-secondary text-foreground'}`}
                          style={msg.userRole === 'admin' ? { backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' } : {}}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{msg.userRole === 'admin' ? 'You' : t.userName}</span>
                            {i === 0 && <Badge variant="outline" className="text-[10px] px-1 py-0">Original</Badge>}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-[10px] opacity-60 mt-1">{formatDate(msg.createdAt)}</p>
                        </div>
                      </div>
                    ))}

                    {t.status === 'open' && (
                      <div className="flex gap-2 pt-2">
                        <textarea
                          value={adminReplyText}
                          onChange={(e) => setAdminReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          rows={2}
                          className="flex-1 min-h-[40px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <Button
                          size="icon"
                          className="shrink-0 self-end"
                          disabled={adminReplySending || !adminReplyText.trim()}
                          style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                          onClick={() => handleAdminReply(selectedTicket)}
                        >
                          <Send className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          ) : adminTickets.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No tickets yet.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {adminTickets.map((t) => (
                <button key={t.id} onClick={() => openTicket(t.id)} className="w-full text-left">
                  <Card className="hover:bg-secondary/30 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate">{t.subject}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.userName} ({t.userEmail}) &middot; {formatDate(t.createdAt)}
                        </p>
                      </div>
                      <Badge variant={t.status === 'open' ? 'secondary' : 'outline'}>
                        {t.status === 'open' ? 'Open' : 'Closed'}
                      </Badge>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <section className="flex flex-col gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      {u.banned && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {u.suspensionType === 'terminated' ? 'Terminated' : 'Suspended'}
                        </Badge>
                      )}
                      {u.banned && !u.appealable && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Not appealable</Badge>}
                      {u.role === 'admin' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Admin</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                    <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                      <span>Limit: {formatBytes(u.storageLimit)}</span>
                      <span>Credits: {u.creditsRemaining}</span>
                      <span>Joined: {formatDate(u.createdAt)}</span>
                    </div>
                    {u.suspensionReason && (
                      <p className="text-xs text-destructive mt-1 italic truncate">
                        {u.suspensionReason}
                        {u.suspensionType === 'terminated' && u.terminatedAt && (
                          <> &middot; Terminated {formatDate(u.terminatedAt)}</>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    <div className="flex gap-1.5">
                      {u.banned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs"
                          onClick={() => handleAction(u.id, 'unlock', () => unlockUser(u.id), 'User unlocked')}
                          disabled={processing[`unlock-${u.id}`]}
                        >
                          <Unlock className="size-3" />
                          {processing[`unlock-${u.id}`] ? '...' : 'Unlock'}
                        </Button>
                      ) : u.role !== 'admin' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => setSuspendModal({ userId: u.id, userName: u.name })}
                        >
                          <Ban className="size-3" />
                          Suspend
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        onClick={() => handleAction(u.id, 'revoke', () => revokePublicFiles(u.id), 'Public files revoked')}
                        disabled={processing[`revoke-${u.id}`]}
                      >
                        <GlobeOff className="size-3" />
                        {processing[`revoke-${u.id}`] ? '...' : 'Revoke public'}
                      </Button>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <span className="text-[10px] text-muted-foreground">Storage:</span>
                      <input
                        type="text"
                        placeholder="e.g. 50GB"
                        value={customStorage[u.id] ?? ''}
                        onChange={(e) =>
                          setCustomStorage((s) => ({ ...s, [u.id]: e.target.value }))
                        }
                        className="h-7 w-20 rounded border border-input bg-transparent px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        onClick={() =>
                          handleAction(
                            u.id,
                            'set',
                            () => setStorageLimit(u.id, customStorage[u.id]),
                            'Storage limit updated',
                          )
                        }
                        disabled={processing[`set-${u.id}`] || !customStorage[u.id]?.trim()}
                      >
                        <Pencil className="size-3" />
                        {processing[`set-${u.id}`] ? '...' : 'Set'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        onClick={() => handleAction(u.id, 'reset', () => resetStorageLimit(u.id), 'Storage limit reset')}
                        disabled={processing[`reset-${u.id}`]}
                      >
                        <RotateCcw className="size-3" />
                        {processing[`reset-${u.id}`] ? '...' : 'Reset'}
                      </Button>
                    </div>
                    <div className="flex gap-1.5 items-center mt-1">
                      <Coins className="size-3 text-yellow-600 dark:text-yellow-400" />
                      <input
                        type="number"
                        step="any"
                        min="1"
                        placeholder="Credits"
                        value={issueCreditAmounts[u.id] ?? ''}
                        onChange={(e) =>
                          setIssueCreditAmounts((s) => ({ ...s, [u.id]: e.target.value }))
                        }
                        className="h-7 w-20 rounded border border-input bg-transparent px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        onClick={() => handleIssueCredits(u.id)}
                        disabled={processing[`issue-${u.id}`] || !issueCreditAmounts[u.id]?.trim()}
                      >
                        <Coins className="size-3" />
                        {processing[`issue-${u.id}`] ? '...' : 'Issue'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {users.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No users found.
              </CardContent>
            </Card>
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
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SUSPENSION_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
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
