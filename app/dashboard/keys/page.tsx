'use client'

import { useState, useEffect } from 'react'
import { getApiKeys, createApiKey, deleteApiKey } from '@/app/actions/api-keys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import Link from 'next/link'

type ApiKey = Awaited<ReturnType<typeof getApiKeys>>[number]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = async () => {
    const k = await getApiKeys()
    setKeys(k)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const raw = await createApiKey(name.trim())
      setNewKey(raw)
      setShowNewKey(true)
      setName('')
      await refresh()
      toast.success('API key created')
    } catch {
      toast.error('Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await deleteApiKey(id)
      await refresh()
      toast.success('API key deleted')
    } catch {
      toast.error('Failed to delete key')
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Use API keys to authenticate programmatic uploads from your app or CI pipeline.
        </p>
      </div>

      {/* New key reveal */}
      {newKey && (
        <Card className="border" style={{ borderColor: 'var(--brand)', backgroundColor: 'var(--brand-muted)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="size-4" style={{ color: 'var(--brand)' }} />
              Your new API key
            </CardTitle>
            <CardDescription>
              Copy this key now — it will not be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-background border border-border rounded-md px-3 py-2 overflow-hidden">
                {showNewKey ? newKey : '•'.repeat(Math.min(newKey.length, 40))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => setShowNewKey((v) => !v)}
                title={showNewKey ? 'Hide key' : 'Show key'}
              >
                {showNewKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => handleCopy(newKey)}
                title="Copy key"
              >
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <Button variant="outline" size="sm" className="self-end" onClick={() => setNewKey(null)}>
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create key form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm">Create new key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="key-name" className="text-xs">Key name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Production, CI/CD, Local dev"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={creating || !name.trim()}
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              <Plus className="size-4" data-icon="inline-start" />
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Keys list */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Your keys</h2>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="size-8 rounded-md" />
              </div>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center border border-dashed border-border rounded-xl">
            <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
              <Key className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No API keys</p>
              <p className="text-xs text-muted-foreground mt-0.5">Create a key to start using the API</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
              >
                <div className="size-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Key className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{key.name}</p>
                    <Badge variant="outline" className="font-mono text-xs shrink-0">
                      {key.keyPrefix}...
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created {formatDate(key.createdAt)}
                    {key.lastUsedAt ? ` · Last used ${formatDate(key.lastUsedAt)}` : ' · Never used'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(key.id)}
                  title="Delete key"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Docs link */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" />
          API reference
        </h2>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              See the full API documentation for upload, download, authentication, and all available endpoints.
            </p>
            <Link href="/docs">
              <Button variant="outline" size="sm" className="gap-1.5">
                <BookOpen className="size-3.5" />
                Read the API docs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any applications using this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  )
}
