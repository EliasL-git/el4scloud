'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { verifyEmailCode, getEmailVerificationCode } from '@/app/actions/verify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Mail, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react'

function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlEmail = searchParams.get('email') || ''

  const [email, setEmail] = useState(urlEmail)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'loading' | 'verify' | 'success'>(urlEmail ? 'verify' : 'loading')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!urlEmail) {
      setStep(prev => prev === 'loading' ? 'verify' : prev)
      return
    }
    setSending(true)
    getEmailVerificationCode(urlEmail).then((res) => {
      if (res.ok && 'code' in res) {
        setDevCode(res.code as string)
      }
      setStep('verify')
    }).catch(() => {
      setStep('verify')
    }).finally(() => setSending(false))
  }, [urlEmail])

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')

    if (!email) {
      setError('Please enter your email.')
      setSending(false)
      return
    }

    const result = await getEmailVerificationCode(email)
    if (result.ok && 'code' in result) {
      setDevCode(result.code as string)
    }
    setSending(false)
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
              <p className="text-xs text-muted-foreground">
                Your storage has been upgraded to 2.5 GB.
              </p>
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                Go to dashboard
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

        {step === 'loading' ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-5 animate-spin" />
              <p className="text-sm text-muted-foreground">Sending verification code...</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Verify your email</CardTitle>
                  <CardDescription className="mt-1">
                    Your account is locked until you verify your email. Check your inbox (and spam) for the verification code.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {devCode && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Dev mode — your code</p>
                  <p className="text-2xl tracking-[10px] font-mono font-bold">{devCode}</p>
                </div>
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
                    <Mail className="size-4" />
                  )}
                  Verify email
                </Button>
              </form>

              <div className="border-t border-border pt-3 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground text-center">
                  Didn&apos;t receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sending}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {sending ? 'Sending...' : 'Send a new code'}
                  </button>
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Wrong email?{' '}
                  <button
                    type="button"
                    onClick={() => setStep('verify')}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Change it
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!urlEmail && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enter your email</CardTitle>
              <CardDescription>We&apos;ll send a verification code.</CardDescription>
            </CardHeader>
            <CardContent>
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
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full"
                  style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : 'Send code'}
                </Button>
              </form>
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