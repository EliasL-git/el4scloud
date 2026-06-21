'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CloudUpload, X, FileIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getPresignedUploadUrl } from '@/app/actions/files'
import { toast } from 'sonner'

interface PendingFile {
  file: File
  id: string
  progress: number
  status: 'idle' | 'uploading' | 'done' | 'error'
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function FileUploader({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [isPublic, setIsPublic] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles: PendingFile[] = accepted.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      progress: 0,
      status: 'idle',
    }))
    setPending((prev) => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  })

  const removeFile = (id: string) => {
    setPending((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadAll = async () => {
    const toUpload = pending.filter((f) => f.status === 'idle')
    if (toUpload.length === 0) return

    for (const pf of toUpload) {
      setPending((prev) =>
        prev.map((f) => (f.id === pf.id ? { ...f, status: 'uploading', progress: 0 } : f))
      )

      try {
        const { presignedUrl } = await getPresignedUploadUrl(
          pf.file.name,
          pf.file.type || 'application/octet-stream',
          pf.file.size,
          isPublic,
        )

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setPending((prev) =>
                prev.map((f) => (f.id === pf.id ? { ...f, progress: pct } : f))
              )
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve()
            else reject(new Error(`Upload failed: ${xhr.status}`))
          }
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.open('PUT', presignedUrl)
          xhr.setRequestHeader('Content-Type', pf.file.type || 'application/octet-stream')
          xhr.send(pf.file)
        })

        setPending((prev) =>
          prev.map((f) => (f.id === pf.id ? { ...f, status: 'done', progress: 100 } : f))
        )
      } catch (err) {
        setPending((prev) =>
          prev.map((f) => (f.id === pf.id ? { ...f, status: 'error' } : f))
        )
        toast.error(`Failed to upload ${pf.file.name}`)
      }
    }

    // After all done, notify parent and clear completed
    setPending((prev) => prev.filter((f) => f.status !== 'done'))
    onUploadComplete()
    toast.success('Upload complete')
  }

  const idleCount = pending.filter((f) => f.status === 'idle').length
  const uploadingCount = pending.filter((f) => f.status === 'uploading').length

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors text-center',
          isDragActive
            ? 'border-[var(--brand)] bg-[var(--brand-muted)]'
            : 'border-border bg-secondary/30 hover:bg-secondary/60 hover:border-muted-foreground/40'
        )}
      >
        <input {...getInputProps()} />
        <div
          className="size-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--brand-muted)' }}
        >
          <CloudUpload className="size-5" style={{ color: 'var(--brand)' }} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
        </div>
      </div>

      {/* Options row */}
      <div className="flex items-center gap-2">
        <Switch id="public-toggle" checked={isPublic} onCheckedChange={setIsPublic} />
        <Label htmlFor="public-toggle" className="text-sm cursor-pointer">
          Make file publicly accessible
        </Label>
      </div>

      {/* Pending files list */}
      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          {pending.map((pf) => (
            <div
              key={pf.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border"
            >
              <FileIcon className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{pf.file.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(pf.file.size)}
                  </span>
                </div>
                {pf.status === 'uploading' && (
                  <Progress value={pf.progress} className="h-1 mt-1.5" />
                )}
                {pf.status === 'done' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Uploaded</p>
                )}
                {pf.status === 'error' && (
                  <p className="text-xs text-destructive mt-0.5">Upload failed</p>
                )}
              </div>
              {(pf.status === 'idle' || pf.status === 'error') && (
                <button
                  onClick={() => removeFile(pf.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Remove file"
                >
                  <X className="size-4" />
                </button>
              )}
              {pf.status === 'uploading' && (
                <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {idleCount > 0 && (
        <Button
          onClick={uploadAll}
          disabled={uploadingCount > 0}
          style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
          className="self-end"
        >
          {uploadingCount > 0 ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Uploading...
            </>
          ) : (
            <>
              <CloudUpload className="size-4" data-icon="inline-start" />
              Upload {idleCount} file{idleCount !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
