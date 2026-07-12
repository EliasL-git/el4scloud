'use client'

import { useEffect, useRef, useState } from 'react'
import { getUnseenBroadcasts, acknowledgeBroadcast, acknowledgeAllBroadcasts } from '@/app/actions/broadcasts'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Megaphone } from 'lucide-react'

type Broadcast = Awaited<ReturnType<typeof getUnseenBroadcasts>>[number]

export function BroadcastPopup() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    getUnseenBroadcasts().then((unseen) => {
      if (unseen.length > 0) {
        setBroadcasts(unseen)
        setCurrentIndex(0)
        setOpen(true)
      }
    })
  }, [])

  const current = broadcasts[currentIndex]
  if (broadcasts.length === 0) return null

  const handleDismiss = async () => {
    await acknowledgeBroadcast(current.id)
    if (currentIndex + 1 < broadcasts.length) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setOpen(false)
    }
  }

  const handleCloseAll = async () => {
    await acknowledgeAllBroadcasts()
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCloseAll() }}>
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
          <AlertDialogCancel onClick={handleCloseAll}>Close all</AlertDialogCancel>
          {currentIndex + 1 < broadcasts.length ? (
            <AlertDialogCancel onClick={handleDismiss}>Next</AlertDialogCancel>
          ) : (
            <AlertDialogCancel onClick={handleDismiss}>Got it</AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
