'use client'

import { useState, useEffect } from 'react'
import { getScanStats } from '@/app/actions/admin'
import { Card, CardContent } from '@/components/ui/card'
import { HardDrive } from 'lucide-react'

interface ScanStats {
  avgDuration: number | null
  totalScans: number
  past24hScans: number
}

export default function AdminScanHealthPage() {
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [statusCounts, setStatusCounts] = useState<Array<{ status: string; count: number }>>([])

  useEffect(() => {
    getScanStats().then((s) => setStats(s))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <HardDrive className="size-5" />
          Scan Health
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">ClamAV scan status across all files</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Scanned</p>
            <p className="text-2xl font-semibold tracking-tight mt-1">{stats?.totalScans ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Past 24h</p>
            <p className="text-2xl font-semibold tracking-tight mt-1">{stats?.past24hScans ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg Duration</p>
            <p className="text-2xl font-semibold tracking-tight mt-1">{stats?.avgDuration != null ? `${stats.avgDuration}ms` : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Status Breakdown</h3>
          <p className="text-sm text-muted-foreground">Use the overview panel for live scan status counts.</p>
        </CardContent>
      </Card>
    </div>
  )
}
