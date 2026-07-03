'use client'

import { useState, useEffect } from 'react'
import { getFlaggedFiles, removeFlaggedHash } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

interface FlaggedRow {
  id: string
  hash: string
  fileId: string
  flaggedBy: string
  createdAt: Date
  fileName: string | null
  userName: string | null
}

export default function AdminFlaggedFilesPage() {
  const [rows, setRows] = useState<FlaggedRow[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  const load = async () => {
    const data = await getFlaggedFiles()
    setRows(data)
  }

  useEffect(() => {
    load()
  }, [])

  const handleRemove = async (id: string) => {
    setLoading(id)
    await removeFlaggedHash(id)
    await load()
    setLoading(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldAlert className="size-5" />
          Flagged Files
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Hashes blocked by ClamAV or admin action</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Hash</th>
                <th className="p-3 font-medium">File</th>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Source</th>
                <th className="p-3 font-medium">Flagged At</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={6}>No flagged hashes</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs">{r.hash.slice(0, 32)}...</td>
                  <td className="p-3">{r.fileName || 'Deleted'}</td>
                  <td className="p-3">{r.userName || (r.fileId ? 'Unknown' : '-')}</td>
                  <td className="p-3 capitalize">{r.flaggedBy === 'auto' ? 'ClamAV' : r.flaggedBy}</td>
                  <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => handleRemove(r.id)} disabled={loading === r.id}>
                      {loading === r.id ? 'Removing...' : 'Remove'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
