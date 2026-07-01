'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket, getMyTickets } from '@/app/actions/tickets'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, MessageSquare, ChevronRight, Clock, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Ticket = Awaited<ReturnType<typeof getMyTickets>>[number]

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'account', label: 'Account' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'feature_request', label: 'Feature Request' },
] as const

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'critical', label: 'Critical' },
] as const

const priorityConfig: Record<string, { color: string; icon: React.ElementType }> = {
  critical: { color: 'text-red-500 border-red-500/30 bg-red-500/10', icon: AlertTriangle },
  urgent: { color: 'text-orange-500 border-orange-500/30 bg-orange-500/10', icon: AlertCircle },
  high: { color: 'text-amber-500 border-amber-500/30 bg-amber-500/10', icon: AlertCircle },
  normal: { color: 'text-blue-500 border-blue-500/30 bg-blue-500/10', icon: Info },
  low: { color: 'text-muted-foreground', icon: Info },
}

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'outline' | 'default' | 'destructive' }> = {
  open: { label: 'Open', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  waiting_on_customer: { label: 'Waiting on you', variant: 'outline' },
  resolved: { label: 'Resolved', variant: 'outline' },
  closed: { label: 'Closed', variant: 'outline' },
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

export default function SupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('normal')
  const [sending, setSending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const t = await getMyTickets()
    setTickets(t)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    try {
      const id = await createTicket(subject.trim(), message.trim(), category, priority)
      toast.success('Ticket created')
      setOpen(false)
      setSubject('')
      setMessage('')
      setCategory('general')
      setPriority('normal')
      router.push(`/dashboard/support/${id}`)
    } catch {
      toast.error('Failed to create ticket')
    } finally {
      setSending(false)
    }
  }

  const openCount = tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved').length

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Get help with your account or files.
          </p>
        </div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={
              <Button size="sm" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>
                <Plus className="size-4" />
                New ticket
              </Button>
            }
          />
          <AlertDialogContent>
            <form onSubmit={handleSubmit}>
              <AlertDialogHeader>
                <AlertDialogTitle>New support ticket</AlertDialogTitle>
                <AlertDialogDescription>
                  Describe your issue and we&apos;ll get back to you.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Upload not working"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="h-9 rounded-md border border-input bg-card px-2.5 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="bg-card text-foreground">{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="priority">Priority</Label>
                    <select
                      id="priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="h-9 rounded-md border border-input bg-card px-2.5 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value} className="bg-card text-foreground">{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {priority === 'critical' && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span>Critical issues are for service outages or security incidents only.</span>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="message">Message</Label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    required
                    rows={5}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                <AlertDialogAction type="submit" disabled={sending}>
                  {sending ? 'Sending...' : 'Submit'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {openCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Clock className="size-3" />
          <span>{openCount} active ticket{openCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse flex flex-col gap-2">
                  <div className="h-4 bg-secondary rounded w-2/3" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                  <div className="h-3 bg-secondary rounded w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="size-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No tickets yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Create a ticket and we&apos;ll get back to you as soon as possible.
            </p>
            <Button
              size="sm"
              className="mt-4 gap-1.5"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              onClick={() => setOpen(true)}
            >
              <Plus className="size-3.5" />
              Create first ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((ticket) => {
            const pConfig = priorityConfig[ticket.priority] ?? priorityConfig.normal
            const PrioIcon = pConfig.icon
            const sConfig = statusConfig[ticket.status] ?? statusConfig.open
            return (
              <button
                key={ticket.id}
                onClick={() => router.push(`/dashboard/support/${ticket.id}`)}
                className="w-full text-left group"
              >
                <Card className="hover:bg-secondary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        {ticket.replyCount > 0 && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {ticket.replyCount} {ticket.replyCount === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {ticket.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          Created {formatRelative(ticket.createdAt)}
                        </span>
                        {ticket.updatedAt && new Date(ticket.updatedAt).getTime() > new Date(ticket.createdAt).getTime() + 60000 && (
                          <span className="text-[11px] text-muted-foreground">
                            Updated {formatRelative(ticket.updatedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={sConfig.variant as any} className="text-[10px] px-1.5 py-0 gap-0.5">
                        {sConfig.label}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${pConfig.color}`}>
                        <PrioIcon className="size-2.5" />
                        {ticket.priority}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      <Toaster />
    </div>
  )
}
