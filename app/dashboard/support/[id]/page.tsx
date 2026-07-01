'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getTicket, getTicketReplies, replyToTicket, closeTicket } from '@/app/actions/tickets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, XCircle, CheckCircle2, User, AlertTriangle, AlertCircle, Info, Clock, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type Ticket = Awaited<ReturnType<typeof getTicket>>
type Reply = Awaited<ReturnType<typeof getTicketReplies>>[number]

const priorityConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  critical: { color: 'text-red-500 border-red-500/30 bg-red-500/10', label: 'Critical', icon: AlertTriangle },
  urgent: { color: 'text-orange-500 border-orange-500/30 bg-orange-500/10', label: 'Urgent', icon: AlertCircle },
  high: { color: 'text-amber-500 border-amber-500/30 bg-amber-500/10', label: 'High', icon: AlertCircle },
  normal: { color: 'text-blue-500 border-blue-500/30 bg-blue-500/10', label: 'Normal', icon: Info },
  low: { color: 'text-muted-foreground', label: 'Low', icon: Info },
}

const statusConfig: Record<string, { label: string; color: string; variant: 'secondary' | 'outline' | 'default' | 'destructive' }> = {
  open: { label: 'Open', color: '', variant: 'secondary' },
  in_progress: { label: 'In Progress', color: 'text-blue-500', variant: 'default' },
  waiting_on_customer: { label: 'Waiting on you', color: 'text-amber-500', variant: 'outline' },
  resolved: { label: 'Resolved', color: 'text-green-500', variant: 'outline' },
  closed: { label: 'Closed', color: '', variant: 'outline' },
}

const categoryLabels: Record<string, string> = {
  account: 'Account', billing: 'Billing', technical: 'Technical',
  abuse: 'Abuse', feature_request: 'Feature Request', general: 'General',
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

function formatRelative(date: Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [t, r] = await Promise.all([getTicket(id), getTicketReplies(id)])
      setTicket(t)
      setReplies(r)
    } catch {
      router.push('/dashboard/support')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [replies])

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    setSending(true)
    try {
      await replyToTicket(id, replyText.trim())
      setReplyText('')
      await refresh()
      toast.success('Reply sent')
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const handleClose = async () => {
    try {
      await closeTicket(id)
      await refresh()
      toast.success('Ticket closed')
    } catch {
      toast.error('Failed to close ticket')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground w-fit">
          <ArrowLeft className="size-3.5" /> Back to tickets
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="animate-pulse flex flex-col gap-2">
              <div className="h-5 bg-secondary rounded w-2/3" />
              <div className="h-3 bg-secondary rounded w-1/4" />
            </div>
          </CardHeader>
        </Card>
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[80%] rounded-xl p-4 bg-secondary animate-pulse">
                <div className="h-3 bg-muted rounded w-16 mb-2" />
                <div className="h-3 bg-muted rounded w-48 mb-1" />
                <div className="h-3 bg-muted rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!ticket) return null

  const allMessages = [
    { id: ticket.id, message: ticket.message, createdAt: ticket.createdAt, userId: ticket.userId, userName: 'You', userRole: 'user' },
    ...replies,
  ]

  const pConfig = priorityConfig[ticket.priority] ?? priorityConfig.normal
  const PrioIcon = pConfig.icon
  const sConfig = statusConfig[ticket.status] ?? statusConfig.open

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <button
        onClick={() => router.push('/dashboard/support')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft className="size-3.5" />
        Back to tickets
      </button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-sm font-medium">{ticket.subject}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {formatRelative(ticket.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ticket.status === 'open' ? (
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={handleClose}>
                    <XCircle className="size-3" /> Close
                  </Button>
                ) : ticket.status === 'resolved' || ticket.status === 'closed' ? (
                  <Badge variant="outline" className="gap-1 text-[11px]">
                    <CheckCircle2 className="size-3" />
                    {sConfig.label}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={sConfig.variant as any} className="text-[10px] px-1.5 py-0">
                {sConfig.label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${pConfig.color}`}>
                <PrioIcon className="size-2.5" />
                {pConfig.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                <Tag className="size-2.5" />
                {categoryLabels[ticket.category] ?? ticket.category}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3 px-1">
        {allMessages.map((msg, i) => {
          const isAdmin = msg.userRole === 'admin'
          const isYou = msg.userRole === 'user'
          return (
            <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
              <div className="flex gap-2 max-w-[85%]">
                {isAdmin && (
                  <div className="size-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                    <User className="size-3.5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <div
                    className={`rounded-xl px-4 py-3 ${
                      isAdmin
                        ? 'bg-secondary text-foreground rounded-tl-sm'
                        : 'text-primary-foreground rounded-tr-sm'
                    }`}
                    style={
                      isYou
                        ? { backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {isAdmin ? 'Support' : 'You'}
                      </span>
                      {i === 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-none">
                          Original
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className="text-[10px] opacity-60 mt-1.5">
                      {formatRelative(msg.createdAt)}
                    </p>
                  </div>
                </div>
                {isYou && (
                  <div className="size-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-1">
                    <User className="size-3.5" style={{ color: 'var(--brand)' }} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {(ticket.status === 'open' || ticket.status === 'in_progress' || ticket.status === 'waiting_on_customer') && (
        <form onSubmit={handleReply} className="flex gap-2 pt-2 border-t border-border mt-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            required
            rows={2}
            className="flex-1 min-h-[40px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e) }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 self-end"
            disabled={sending || !replyText.trim()}
            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
          >
            <Send className="size-4" />
          </Button>
        </form>
      )}

      <Toaster />
    </div>
  )
}
