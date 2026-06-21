'use client'

import { ArrowLeft } from 'lucide-react'

export function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
    >
      <ArrowLeft className="size-3.5" />
      Go back
    </button>
  )
}
