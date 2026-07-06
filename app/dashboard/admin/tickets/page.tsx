'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  adminGetTickets, adminGetTicketReplies, adminReplyToTicket,
  adminCloseTicket, adminReopenTicket, adminGetAdmins, adminGetTicketStats,
} from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronRight, Send, Pencil, XCircle, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, sectionTitle } from '../_lib/utils'
import { getCategoryLabel, getSubcategoryLabel, CATEGORIES } from '@/lib/ticket-categories'

type AdminTicket = Awaited<ReturnType<typeof adminGetTickets>>[number]
type AdminReply = Awaited<ReturnType<typeof adminGetTicketReplies>>[number]

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [ticketFilter, setTicketFilter] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all')
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState('all')
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('all')
  const [ticketAssignFilter, setTicketAssignFilter] = useState('all')
  const [ticketReplies, setTicketReplies] = useState<AdminReply[]>([])
  const [adminReplyText, setAdminReplyText] = useState('')
  const [adminReplySending, setAdminReplySending] = useState(false)
  const [adminsList, setAdminsList] = useState<Awaited<ReturnType<typeof adminGetAdmins>>>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [t, ad] = await Promise.all([adminGetTickets(), adminGetAdmins()])
    setTickets(t)
    setAdminsList(ad)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

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
      toast.success(isInternal ? 'Internal note added' : 'Reply sent')
    } catch { toast.error('Failed to send reply') }
    finally { setAdminReplySending(false) }
  }

  const filteredTickets = tickets.filter((t) => {
    if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false
    if (ticketCategoryFilter !== 'all' && t.category !== ticketCategoryFilter) return false
    if (ticketPriorityFilter !== 'all' && t.priority !== ticketPriorityFilter) return false
    if (ticketAssignFilter === 'unassigned' && t.assignedTo) return false
    if (ticketAssignFilter !== 'all' && ticketAssignFilter !== 'unassigned' && ticketAssignFilter !== t.assignedTo) return false
    if (!ticketFilter.trim()) return true
    const q = ticketFilter.toLowerCase()
    return t.subject.toLowerCase().includes(q) || t.userName.toLowerCase().includes(q) || t.userEmail.toLowerCase().includes(q) || t.message.toLowerCase().includes(q)
  })

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Tickets')}
      {selectedTicket ? (
        <div className="flex flex-col gap-3">
          <Button size="sm" variant="ghost" className="w-fit gap-1.5" onClick={() => setSelectedTicket(null)}><ArrowLeft className="size-3.5" /> Back</Button>
          {(() => {
            const t = tickets.find((t) => t.id === selectedTicket)
            if (!t) return null
            return (
              <div className="flex flex-col gap-3">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-medium">{t.subject}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.userName} &lt;{t.userEmail}&gt;</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{getCategoryLabel(t.category)} / {getSubcategoryLabel(t.category, t.subcategory)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={t.status === 'open' ? 'secondary' : t.status === 'in_progress' ? 'default' : 'outline'}>{t.status}</Badge>
                        <Badge variant={t.priority === 'high' ? 'destructive' : t.priority === 'medium' ? 'default' : 'secondary'}>{t.priority}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap">{t.message}</CardContent>
                </Card>
                {ticketReplies.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={r.userRole === 'admin' ? 'font-medium text-foreground' : ''}>{r.userRole === 'admin' ? 'Staff' : t.userName}</span>
                        <span>{formatDate(r.createdAt)}</span>
                        {r.isInternal && <Badge variant="outline" className="text-xs">Internal</Badge>}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                    </CardContent>
                  </Card>
                ))}
                <div className="flex flex-col gap-2 pt-2">
                  <textarea value={adminReplyText} onChange={(e) => setAdminReplyText(e.target.value)} placeholder="Type your reply..." rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => handleAdminReply(t.id, false)} disabled={adminReplySending || !adminReplyText.trim()}><Send className="size-3.5" /> Reply</Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAdminReply(t.id, true)} disabled={adminReplySending || !adminReplyText.trim()}><Pencil className="size-3.5" /> Internal note</Button>
                    {t.status !== 'closed' && (
                      <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={async () => { try { await adminCloseTicket(t.id); toast.success('Ticket closed'); await refresh(); setSelectedTicket(null) } catch { toast.error('Failed') } }}><XCircle className="size-3.5" /> Close</Button>
                    )}
                    {t.status === 'closed' && (
                      <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={async () => { try { await adminReopenTicket(t.id); toast.success('Ticket reopened'); await refresh() } catch { toast.error('Failed') } }}><RotateCcw className="size-3.5" /> Reopen</Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            <input type="text" placeholder="Search tickets..." value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)} className="h-8 w-64 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <select value={ticketStatusFilter} onChange={(e) => setTicketStatusFilter(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>
            <select value={ticketCategoryFilter} onChange={(e) => setTicketCategoryFilter(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground">
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
            <select value={ticketPriorityFilter} onChange={(e) => setTicketPriorityFilter(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground">
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select value={ticketAssignFilter} onChange={(e) => setTicketAssignFilter(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground">
              <option value="all">All assignments</option>
              <option value="unassigned">Unassigned</option>
              {adminsList.map((a) => (<option key={a.id} value={a.id}>{a.name ?? a.email}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            {filteredTickets.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No tickets found.</CardContent></Card>
            ) : (
              filteredTickets.map((t) => (
                <Card key={t.id} className="cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => openTicket(t.id)}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{t.subject}</p>
                        <Badge variant={t.status === 'open' ? 'secondary' : t.status === 'in_progress' ? 'default' : 'outline'} className="text-xs shrink-0">{t.status}</Badge>
                        <Badge variant={t.priority === 'high' ? 'destructive' : t.priority === 'medium' ? 'default' : 'secondary'} className="text-xs shrink-0">{t.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.userName} &lt;{t.userEmail}&gt;</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{getCategoryLabel(t.category)} / {getSubcategoryLabel(t.category, t.subcategory)}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </section>
  )
}
