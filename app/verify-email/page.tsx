'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { resendVerificationEmail, verifyEmailCode } from '@/app/actions/verify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Mail, MailCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlEmail = searchParams.get('email') || ''

  const [email, setEmail] = useState(urlEmail)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'request' | 'verify' | 'success' | 'error'>(urlEmail ? 'verify' : 'request')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rateLimitError, setRateLimitError] = useState('')

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setRateLimitError('')

    if (!email) {
      setError('Please enter your email.')
      setLoading(false)
      return
    }

    const result = await resendVerificationEmail(email)
    if (result.ok) {
      setStep('verify')
    } else {
      if (result.error?.startsWith('Please wait')) {
        setRateLimitError(result.error)
      } else {
        setError(result.error || 'Failed to send verification code.')
      }
    }
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!code || code.length !== 6) {
      setError('Please enter the full 6-digit code.')
      setLoading(false)
      return
    }

    const result = await verifyEmailCode(email, code)
    if (result.ok) {
      setStep('success')
    } else {
      setError(result.error || 'Failed to verify code.')
    }
    setLoading(false)
  }

  if (step === 'success') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2">
            <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
              <HardDrive className="size-4" style={{ color: 'var(--brand-foreground)' }} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Hobbycloud</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600" />
                Email verified
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 items-center text-center">
              <p className="text-sm text-muted-foreground">
                Your email <strong>{email}</strong> has been verified.
              </p>
              <Button
                onClick={() => router.push('/sign-in')}
                className="w-full"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                Sign in to your account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
            <HardDrive className="size-4" style={{ color: 'var(--brand-foreground)' }} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">Hobbycloud</span>
        </div>

        {rateLimitError && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="size-4 text-amber-600" />
                Rate limited
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{rateLimitError}</p>
            </CardContent>
          </Card>
        )}

        {step === 'request' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Verify your email</CardTitle>
              <CardDescription>
                Enter your email and we&apos;ll send you a 6-digit verification code.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleSendCode} className="flex flex-col gap-4">
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
                  disabled={loading}
                  className="w-full"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  Send verification code
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Enter verification code</CardTitle>
              <CardDescription>
                We sent a 6-digit code to <strong>{email}</strong>. Check your inbox.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {urlEmail && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="size-3" />
                  Lost the page? No worries — enter the code from your email below.
                </p>
              )}

              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Verification code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    className="text-center text-2xl tracking-[8px] font-mono"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MailCheck className="size-4" />
                  )}
                  Verify email
                </Button>
              </form>

              <div className="border-t border-border pt-3 mt-1">
                <p className="text-xs text-muted-foreground text-center">
                  Didn&apos;t receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Send a new code
                  </button>
                </p>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Wrong email?{' '}
                  <button
                    type="button"
                    onClick={() => setStep('request')}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Change it
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
