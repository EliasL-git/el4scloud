'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getTicket, getTicketReplies, replyToTicket, closeTicket } from '@/app/actions/tickets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type Ticket = Awaited<ReturnType<typeof getTicket>>
type Reply = Awaited<ReturnType<typeof getTicketReplies>>[number]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

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

  useEffect(() => {
    refresh()
  }, [refresh])

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
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    )
  }

  if (!ticket) return null

  const allMessages = [
    { id: ticket.id, message: ticket.message, createdAt: ticket.createdAt, userId: ticket.userId, userName: 'You', userRole: 'user' },
    ...replies,
  ]

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
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium">{ticket.subject}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(ticket.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={ticket.status === 'open' ? 'secondary' : 'outline'}>
                {ticket.status === 'open' ? 'Open' : 'Closed'}
              </Badge>
              {ticket.status === 'open' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={handleClose}
                >
                  <XCircle className="size-3" />
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3">
        {allMessages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex ${msg.userRole === 'admin' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.userRole === 'admin'
                  ? 'bg-secondary text-foreground'
                  : 'text-primary-foreground'
              }`}
              style={
                msg.userRole === 'admin'
                  ? {}
                  : { backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">
                  {msg.userRole === 'admin' ? 'Support' : 'You'}
                </span>
                {i === 0 && <Badge variant="outline" className="text-[10px] px-1 py-0">Original</Badge>}
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              <p className="text-[10px] opacity-60 mt-1">{formatDate(msg.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {ticket.status === 'open' && (
        <form onSubmit={handleReply} className="flex gap-2 pt-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            required
            rows={2}
            className="flex-1 min-h-[40px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
