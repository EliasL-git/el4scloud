'use client'

import { useState } from 'react'
import { exportMyData } from '@/app/actions/account'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `el4scloud-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Data exported')
    } catch {
      toast.error('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account and download your data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export your data</CardTitle>
          <CardDescription>
            Download all your files, API keys, storage requests, support tickets, and profile
            information as a JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5"
            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
          >
            <Download className="size-3.5" />
            {exporting ? 'Exporting...' : 'Download my data'}
          </Button>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  )
}
