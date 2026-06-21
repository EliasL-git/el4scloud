'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CloudUpload } from 'lucide-react'
import { getLegalDate } from '@/lib/legal-date'

export function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    if (!agreed) return
    setLoading(true)
    setError(null)

    const { error } = await authClient.signIn.oauth2({
      providerId: 'hackclub',
      callbackURL: '/dashboard',
    })

    if (error) {
      setError(error.message ?? 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
            <CloudUpload className="size-4" style={{ color: 'var(--brand-foreground)' }} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">el4scloud</span>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Sign in to el4scloud</CardTitle>
            <CardDescription>Authenticate with your Hack Club account</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I agree to the{' '}
                <a href="/legal" className="underline underline-offset-2 hover:text-foreground">
                  Terms of Service
                </a>
                &nbsp;(updated {getLegalDate()})
              </span>
            </label>
            <Button
              onClick={handleSignIn}
              disabled={loading || !agreed}
              className="w-full gap-2"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              <img src="/icons/hackclub.ico" alt="" className="size-5" />
              {loading ? 'Redirecting...' : 'Sign in with Hack Club'}
            </Button>

            {error && (
              <p className="text-sm text-destructive text-center mt-4" role="alert">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
