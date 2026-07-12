'use client'

import { useState, useEffect } from 'react'
import { getBannedDomains, banDomain, unbanDomain } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Ban, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, sectionTitle } from '../_lib/utils'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

type BannedDomain = Awaited<ReturnType<typeof getBannedDomains>>[0]

export default function AdminDomainsPage() {
  const [domains, setDomains] = useState<BannedDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [domainInput, setDomainInput] = useState('')
  const [banning, setBanning] = useState(false)

  useEffect(() => {
    getBannedDomains().then(setDomains).finally(() => setLoading(false))
  }, [])

  const handleBan = async () => {
    if (!domainInput.trim()) return
    setBanning(true)
    try {
      const res = await banDomain(domainInput.trim())
      toast.success(`Domain banned — ${res.affectedUsers} user(s) terminated`)
      setDomainInput('')
      const updated = await getBannedDomains()
      setDomains(updated)
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to ban domain')
    } finally {
      setBanning(false)
    }
  }

  const handleUnban = async (domainId: string) => {
    try {
      await unbanDomain(domainId)
      toast.success('Domain unbanned')
      setDomains((prev) => prev.filter((d) => d.id !== domainId))
    } catch {
      toast.error('Failed to unban domain')
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Banned Domains')}
      <div className="flex gap-2">
        <Input
          placeholder="e.g. tempmail.com"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBan()}
          className="flex-1 max-w-md"
        />
        <Button size="sm" className="gap-1.5" onClick={handleBan} disabled={banning}>
          <Ban className="size-3.5" /> Ban domain
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : domains.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No banned domains yet.</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Banned at</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.domain}</TableCell>
                <TableCell><Badge variant="destructive" className="text-xs">banned</Badge></TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(d.createdAt)}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => handleUnban(d.id)} title="Unban domain">
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
