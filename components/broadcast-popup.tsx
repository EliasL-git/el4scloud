'use client'

import { useEffect, useState } from 'react'
import { getRecentBroadcasts } from '@/app/actions/broadcasts'
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
import { Megaphone } from 'lucide-react'

type Broadcast = Awaited<ReturnType<typeof getRecentBroadcasts>>[number]

const DISMISSED_KEY = 'broadcasts_dismissed'

function getDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function markDismissed(id: string) {
  try {
    const set = getDismissed()
    set.add(id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
  } catch {}
}

export function BroadcastPopup() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getRecentBroadcasts().then((all) => {
      const dismissed = getDismissed()
      const unseen = all.filter((b) => !dismissed.has(b.id))
      if (unseen.length > 0) {
        setBroadcasts(unseen)
        setCurrentIndex(0)
        setOpen(true)
      }
    })
  }, [])

  const current = broadcasts[currentIndex]
  if (broadcasts.length === 0) return null

  const handleNext = () => {
    markDismissed(current.id)
    if (currentIndex + 1 < broadcasts.length) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setOpen(false)
    }
  }

  const handleClose = () => {
    for (const b of broadcasts) markDismissed(b.id)
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="size-4 text-blue-500" />
            {broadcasts.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {broadcasts.length}
              </span>
            )}
          </div>
          <AlertDialogTitle>{current.subject}</AlertDialogTitle>
          {current.body.split('\n').map((line, i) => (
            <AlertDialogDescription key={i}>{line || '\u00A0'}</AlertDialogDescription>
          ))}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Close all</AlertDialogCancel>
          <AlertDialogAction onClick={handleNext}>
            {currentIndex + 1 < broadcasts.length ? 'Next' : 'Got it'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
