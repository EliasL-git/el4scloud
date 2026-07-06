'use client'

import { useState, useEffect } from 'react'
import { getBroadcasts, sendBroadcast } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Send, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, sectionTitle } from '../_lib/utils'

type Broadcast = Awaited<ReturnType<typeof getBroadcasts>>[0]

export default function AdminBroadcastsPage() {
  const [list, setList] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getBroadcasts().then(setList).finally(() => setLoading(false))
  }, [])

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
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <textarea
            placeholder="Message body..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[100px]"
          />
          <div className="flex justify-end">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-2 px-3 font-medium">Subject</th>
                <th className="text-left py-2 px-3 font-medium">Recipients</th>
                <th className="text-left py-2 px-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-3 font-medium">{b.subject}</td>
                  <td className="py-2 px-3"><Badge variant="secondary" className="text-xs">{b.recipientCount}</Badge></td>
                  <td className="py-2 px-3 text-muted-foreground text-xs">{formatDate(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
