'use client'

import { useState, useEffect } from 'react'
import { searchFiles, flagHash } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatBytes, sectionTitle } from '../_lib/utils'

type FileResult = Awaited<ReturnType<typeof searchFiles>>

export default function AdminFilesPage() {
  const [fileQuery, setFileQuery] = useState('')
  const [fileResults, setFileResults] = useState<FileResult>([])
  const [fileSearching, setFileSearching] = useState(false)
  const [hashInput, setHashInput] = useState('')
  const [hashSubmitting, setHashSubmitting] = useState(false)

  useEffect(() => {
    if (fileResults.length === 0 && !fileSearching) {
      setFileSearching(true)
      searchFiles('').then(setFileResults).finally(() => setFileSearching(false))
    }
  }, [])

  const handleFileSearch = async () => {
    setFileSearching(true)
    try { const res = await searchFiles(fileQuery.trim()); setFileResults(res) }
    catch { toast.error('Search failed') }
    finally { setFileSearching(false) }
  }

  const handleFlagHash = async () => {
    if (!hashInput.trim()) return
    setHashSubmitting(true)
    try { await flagHash(hashInput.trim()); toast.success('Hash flagged'); setHashInput('') }
    catch { toast.error('Failed to flag hash (may already exist)') }
    finally { setHashSubmitting(false) }
  }

  return (
    <section className="flex flex-col gap-4">
      {sectionTitle('Files')}
      <div className="flex gap-2">
        <input type="text" placeholder="Search by filename..." value={fileQuery} onChange={(e) => setFileQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFileSearch()} className="h-8 flex-1 max-w-md rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button size="sm" className="gap-1.5" onClick={handleFileSearch} disabled={fileSearching}><Search className="size-3.5" /> Search</Button>
      </div>
      <div className="flex gap-2">
        <input type="text" placeholder="Flag a hash..." value={hashInput} onChange={(e) => setHashInput(e.target.value)} className="h-8 flex-1 max-w-md rounded-md border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleFlagHash} disabled={hashSubmitting}><Ban className="size-3.5" /> Flag hash</Button>
      </div>
      {fileSearching ? (
        <p className="text-sm text-muted-foreground">Searching...</p>
      ) : fileResults.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No files found.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-2 px-3 font-medium">Name</th>
                <th className="text-left py-2 px-3 font-medium">User</th>
                <th className="text-left py-2 px-3 font-medium">Size</th>
                <th className="text-left py-2 px-3 font-medium">Scan</th>
                <th className="text-left py-2 px-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {fileResults.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-3 font-medium max-w-[200px] truncate">{f.name}</td>
                  <td className="py-2 px-3 text-muted-foreground">{f.userId}</td>
                  <td className="py-2 px-3 text-muted-foreground">{formatBytes(f.size)}</td>
                  <td className="py-2 px-3">
                    {f.scanStatus === 'clean' ? <Badge variant="outline" className="text-xs text-green-500 border-green-500/40">clean</Badge>
                    : f.scanStatus === 'infected' ? <Badge variant="destructive" className="text-xs">infected</Badge>
                    : f.scanStatus === 'scanning' ? <Badge variant="secondary" className="text-xs">scanning</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground text-xs">{formatDate(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
