'use client'

import { useState, useEffect } from 'react'
import { getBroadcasts, sendBroadcast, fixBroadcastSpelling } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Send, SpellCheck } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, sectionTitle } from '../_lib/utils'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

type Broadcast = Awaited<ReturnType<typeof getBroadcasts>>[0]

export default function AdminBroadcastsPage() {
  const [list, setList] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [fixing, setFixing] = useState(false)

  useEffect(() => {
    getBroadcasts().then(setList).finally(() => setLoading(false))
  }, [])

  const handleFixSpelling = async () => {
    if (!subject.trim() && !body.trim()) return
    setFixing(true)
    try {
      const result = await fixBroadcastSpelling(subject, body)
      setSubject(result.subject)
      setBody(result.body)
      toast.success('Spelling fixed')
    } catch {
      toast.error('Failed to fix spelling')
    } finally {
      setFixing(false)
    }
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await sendBroadcast(subject.trim(), body.trim())
      toast.success(`Broadcast sent — ${res.sent}/${res.total} delivered`)
      setSubject('')
      setBody('')
      const updated = await getBroadcasts()
      setList(updated)
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send broadcast')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Broadcasts')}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea
            placeholder="Message body..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[100px]"
          />
          <div className="flex justify-between">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleFixSpelling} disabled={fixing || (!subject.trim() && !body.trim())}>
              <SpellCheck className="size-3.5" /> {fixing ? 'Fixing...' : 'Fix spelling'}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSend} disabled={sending}>
              <Send className="size-3.5" /> {sending ? 'Sending...' : 'Send to all users'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : list.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No broadcasts sent yet.</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Accepted</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.subject}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{b.recipientCount}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{b.acknowledgedCount} / {b.recipientCount}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(b.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
