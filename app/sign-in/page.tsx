'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive } from 'lucide-react'

export default function SignInPage() {
  const [mode, setMode] = useState<'oauth' | 'email'>('oauth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleHackclubSignIn() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/sign-in/oauth2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'hackclub', callbackURL: '/dashboard' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Failed to initiate Hack Club sign in.')
        setLoading(false)
      }
    } catch {
      setError('Failed to sign in with Hack Club.')
      setLoading(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!email || !password) {
      setError('Please enter your email and password.')
      setLoading(false)
      return
    }

    try {
      const result = await authClient.signIn.email({ email, password, callbackURL: '/dashboard' })
      if (result.error) {
        setError(result.error.message || 'Invalid email or password.')
      }
    } catch {
      setError('Invalid email or password.')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
            <HardDrive className="size-4" style={{ color: 'var(--brand-foreground)' }} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">el4scloud</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              {mode === 'oauth'
                ? 'Sign in with your Hack Club account'
                : 'Sign in with your email'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {mode === 'oauth' ? (
              <>
                <Button
                  onClick={handleHackclubSignIn}
                  disabled={loading}
                  className="w-full gap-3"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                >
                  <img src="/icons/hackclub.ico" alt="Hack Club" className="size-5 shrink-0" />
                  {loading ? 'Redirecting...' : 'Sign in with Hack Club'}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <button
                  onClick={() => { setMode('email'); setError('') }}
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Sign in with email instead
                </button>
              </>
            ) : (
              <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Your password"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>

                <button
                  type="button"
                  onClick={() => { setMode('oauth'); setError('') }}
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Sign in with Hack Club instead
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a href="/sign-up" className="underline underline-offset-2 hover:text-foreground">
            Register with an access code
          </a>
        </p>
      </div>
    </div>
  )
}
