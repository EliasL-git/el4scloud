'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { resendVerificationEmail } from '@/app/actions/verify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Mail, MailCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsVerification, setNeedsVerification] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNeedsVerification(null)
    setResent(false)

    if (!email || !password) {
      setError('Please enter your email and password.')
      setLoading(false)
      return
    }

    try {
      const result = await authClient.signIn.email({ email, password, callbackURL: '/dashboard' })
      if (result.error) {
        if (result.error.code === 'EMAIL_NOT_VERIFIED') {
          setNeedsVerification(email)
        } else {
          setError(result.error.message || 'Invalid email or password.')
        }
      }
    } catch {
      setError('Invalid email or password.')
    }
    setLoading(false)
  }

  async function handleResend() {
    if (!needsVerification) return
    setResending(true)
    setResent(false)
    const result = await resendVerificationEmail(needsVerification)
    if (result.ok) {
      setResent(true)
    } else {
      setError(result.error || 'Failed to resend verification email.')
    }
    setResending(false)
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
              Sign in with your email
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
                <div className="flex justify-end -mt-1">
                  <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                    Forgot password?
                  </a>
                </div>
              </div>

              {error && !needsVerification && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              {needsVerification ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-start gap-2">
                    <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Email not verified</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        A 6-digit code was sent to your email.{' '}
                        <a href={`/verify-email?email=${encodeURIComponent(needsVerification)}`} className="underline underline-offset-2 hover:text-foreground">
                          Enter it here
                        </a>
                        , or resend below.
                      </p>
                    </div>
                  </div>
                  {resent ? (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <MailCheck className="size-3.5 shrink-0" />
                      Verification email sent!
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleResend}
                      disabled={resending}
                      className="gap-1.5 w-full"
                    >
                      {resending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Mail className="size-3.5" />
                      )}
                      Resend verification email
                    </Button>
                  )}
                  <a
                    href={`/verify-email?email=${encodeURIComponent(needsVerification)}`}
                    className="text-xs text-center text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Already have a code? Enter it here
                  </a>
                </div>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full",
                    "bg-[var(--brand)] text-[var(--brand-foreground)]"
                  )}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          <p>
            Don&apos;t have an account?{' '}
            <a href="/sign-up" className="underline underline-offset-2 hover:text-foreground">
              Create an account
            </a>
          </p>
          <p>
            <a href="/verify-email" className="underline underline-offset-2 hover:text-foreground">
              Resend verification email
            </a>
          </p>
          <div className="flex items-center gap-3 pt-2 text-xs">
            <a href="/legal" className="underline underline-offset-2 hover:text-foreground">Terms</a>
            <a href="/security" className="underline underline-offset-2 hover:text-foreground">Security</a>
          </div>
        </div>
      </div>
    </div>
  )
}
