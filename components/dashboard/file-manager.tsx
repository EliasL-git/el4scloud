'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFiles, getFileStats } from '@/app/actions/files'
import { getFolders, createFolder, deleteFolder, renameFolder, getFolderPath } from '@/app/actions/folders'
import { FileList } from '@/components/dashboard/file-list'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Folder, FolderOpen, Plus, Search, ChevronRight, Home, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type FileRecord = Awaited<ReturnType<typeof getFiles>>[number]
type FolderRecord = Awaited<ReturnType<typeof getFolders>>[number]

interface FileManagerProps {
  onRefresh?: () => void
}

export function FileManager({ onRefresh }: FileManagerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [renameTarget, setRenameTarget] = useState<FolderRecord | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<FolderRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [f, fol] = await Promise.all([
      getFiles({ query: debouncedQuery || undefined, folderId: currentFolderId }),
      debouncedQuery ? Promise.resolve([]) : getFolders(currentFolderId),
    ])
    setFiles(f)
    setFolders(fol)
    if (!debouncedQuery && currentFolderId) {
      const path = await getFolderPath(currentFolderId)
      setFolderPath(path)
    } else {
      setFolderPath([])
    }
    setLoading(false)
  }, [currentFolderId, debouncedQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    loadData()
    onRefresh?.()
  }

  const navigateToFolder = (folderId: string) => {
    setCurrentFolderId(folderId)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  const navigateHome = () => {
    setCurrentFolderId(null)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      await createFolder(newFolderName, currentFolderId ?? undefined)
      toast.success('Folder created')
      setNewFolderName('')
      setShowNewFolder(false)
      handleRefresh()
    } catch {
      toast.error('Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    setRenaming(true)
    try {
      await renameFolder(renameTarget.id, renameValue)
      toast.success('Folder renamed')
      setRenameTarget(null)
      setRenameValue('')
      handleRefresh()
    } catch {
      toast.error('Failed to rename folder')
    } finally {
      setRenaming(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteFolder(deleteTarget.id)
      toast.success('Folder deleted')
      setDeleteTarget(null)
      if (currentFolderId === deleteTarget.id) {
        navigateHome()
      } else {
        handleRefresh()
      }
    } catch {
      toast.error('Failed to delete folder')
    } finally {
      setDeleting(false)
    }
  }

  const isSearching = debouncedQuery.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        {!isSearching && (
          <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={() => setShowNewFolder(true)}>
            <Plus className="size-3.5" />
            Folder
          </Button>
        )}
      </div>

      {!isSearching && (currentFolderId || folderPath.length > 0) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button
            onClick={navigateHome}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="size-3.5" />
            <span>All files</span>
          </button>
          {folderPath.map((item) => (
            <div key={item.id} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              <button
                onClick={() => navigateToFolder(item.id)}
                className="hover:text-foreground transition-colors"
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {!isSearching && folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors group cursor-pointer"
              onClick={() => navigateToFolder(folder.id)}
            >
              <div className="size-8 p-1.5 rounded-lg shrink-0 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                <FolderOpen className="size-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Folder</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                } />
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setRenameTarget(folder); setRenameValue(folder.name) }}
                  >
                    <Pencil className="size-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteTarget(folder) }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {isSearching && files.length === 0 && folders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Search className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">No results</p>
                <p className="text-xs text-muted-foreground mt-0.5">Try a different search term</p>
              </div>
            </div>
          )}

          {!isSearching && folders.length === 0 && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Folder className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">This folder is empty</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upload files or create a folder</p>
              </div>
            </div>
          )}
        </div>
      )}

      {files.length > 0 && !isSearching && folders.length > 0 && (
        <div className="h-px bg-border" />
      )}

      {files.length > 0 && (
        <FileList files={files} loading={false} onRefresh={handleRefresh} />
      )}

      <AlertDialog open={showNewFolder} onOpenChange={(o) => { if (!o) { setShowNewFolder(false); setNewFolderName('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New folder</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new folder to organize your files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder() }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
              {creatingFolder ? 'Creating...' : 'Create'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!renameTarget} onOpenChange={() => { setRenameTarget(null); setRenameValue('') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename folder</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename} disabled={renaming || !renameValue.trim()}>
              {renaming ? 'Saving...' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Files inside will be moved out. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
