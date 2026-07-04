'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptTerms } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

export default function AcceptPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    setLoading(true)
    try {
      await acceptTerms()
      toast.success('Terms accepted')
      router.push('/dashboard')
    } catch {
      toast.error('Failed to accept terms')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-background flex items-center justify-center px-4">
      <div className="max-w-lg text-center flex flex-col items-center gap-6">
        <div className="size-12 rounded-full bg-secondary flex items-center justify-center">
          <svg className="size-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            To continue using Hobbycloud, you need to accept our Terms of Service. You can read
            the full terms at{' '}
            <a href="/legal" className="underline underline-offset-2 hover:text-foreground">
              /legal
            </a>
            .
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleAccept}
          disabled={loading}
          style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
        >
          {loading ? 'Processing...' : 'I accept the Terms of Service'}
        </Button>
        <Toaster />
      </div>
    </div>
  )
}
