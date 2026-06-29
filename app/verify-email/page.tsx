'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { resendVerificationEmail } from '@/app/actions/verify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Mail, MailCheck, Loader2, AlertCircle, Clock } from 'lucide-react'

function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const verificationError = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    setSent(false)

    if (!email) {
      setError('Please enter your email.')
      setSending(false)
      return
    }

    const result = await resendVerificationEmail(email)
    if (result.ok) {
      setSent(true)
    } else {
      setError(result.error || 'Failed to send verification email.')
    }
    setSending(false)
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

        {verificationError === 'TOKEN_EXPIRED' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="size-5 text-amber-600" />
                Link expired
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Your verification link has expired. Enter your email below to receive a new one.
              </p>
            </CardContent>
          </Card>
        )}

        {verificationError === 'INVALID_TOKEN' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <AlertCircle className="size-5 text-destructive" />
                Invalid link
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                That verification link is invalid. Enter your email below to receive a new one.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Verify your email</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a verification link.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="size-12 rounded-full bg-green-100 flex items-center justify-center">
                  <MailCheck className="size-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Check your inbox</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We sent a verification link to <strong>{email}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  Send verification email
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <a href="/sign-in" className="underline underline-offset-2 hover:text-foreground">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  )
}
