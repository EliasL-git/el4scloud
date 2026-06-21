'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getUsers,
  getRequests,
  approveRequest,
  rejectRequest,
  lockUser,
  unlockUser,
  resetStorageLimit,
  setStorageLimit,
  revokePublicFiles,
  adminGetTickets,
  adminGetTicketReplies,
  adminReplyToTicket,
  adminCloseTicket,
  adminReopenTicket,
} from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X, Lock, Unlock, RotateCcw, GlobeOff, Pencil, MessageSquare, Send, ArrowLeft, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type UserRecord = Awaited<ReturnType<typeof getUsers>>[number]
type RequestRecord = Awaited<ReturnType<typeof getRequests>>[number]

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

const statusBadge: Record<string, { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

type Tab = 'requests' | 'users' | 'tickets'

type AdminTicket = Awaited<ReturnType<typeof adminGetTickets>>[number]
type AdminReply = Awaited<ReturnType<typeof adminGetTicketReplies>>[number]

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('requests')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({})
  const [customStorage, setCustomStorage] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [ticketReplies, setTicketReplies] = useState<AdminReply[]>([])
  const [adminReplyText, setAdminReplyText] = useState('')
  const [adminReplySending, setAdminReplySending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [u, r, t] = await Promise.all([getUsers(), getRequests(), adminGetTickets()])
    setUsers(u)
    setRequests(r)
    setAdminTickets(t)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage users and storage upgrade requests.
        </p>
      </div>

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
          Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
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
                      {u.banned && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Banned</Badge>}
                      {u.role === 'admin' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Admin</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                    <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                      <span>Limit: {formatBytes(u.storageLimit)}</span>
                      <span>Joined: {formatDate(u.createdAt)}</span>
                    </div>
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
                          onClick={() => handleAction(u.id, 'lock', () => lockUser(u.id), 'User locked')}
                          disabled={processing[`lock-${u.id}`]}
                        >
                          <Lock className="size-3" />
                          {processing[`lock-${u.id}`] ? '...' : 'Lock'}
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

      <Toaster />
    </div>
  )
}
