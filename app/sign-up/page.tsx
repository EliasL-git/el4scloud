'use client'

import { useState } from 'react'
import { register } from '@/app/actions/register'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Mail, ShieldCheck, Zap } from 'lucide-react'
import type { VerificationMethod } from '@/lib/types'

const tiers: {
  id: VerificationMethod
  title: string
  storage: string
  description: string
  icon: typeof ShieldCheck
}[] = [
  {
    id: 'none',
    title: 'No verification',
    storage: '100 MB',
    description: 'Quick access, upgrade with identity verification later',
    icon: Zap,
  },
  {
    id: 'manual',
    title: 'Email verification',
    storage: '100 MB',
    description: 'Verify your email to access your account, upgrade later',
    icon: ShieldCheck,
  },
]

export default function SignUpPage() {
  const [method, setMethod] = useState<VerificationMethod | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [successMethod, setSuccessMethod] = useState<VerificationMethod | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const name = form.get('name') as string
    const email = form.get('email') as string
    const password = form.get('password') as string
    const confirm = form.get('confirm') as string

    if (!name || !email || !password) {
      setError('All fields are required.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const result = await register({ name, email, password, verificationMethod: method! })
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setRegisteredEmail(email)
    setSuccessMethod(method!)
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2">
            <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
              <HardDrive className="size-4" style={{ color: 'var(--brand-foreground)' }} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">el4scloud</span>
          </div>

          {successMethod === 'none' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-center">Account created!</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                <Zap className="size-8 text-muted-foreground" />
                <p>
                  Your account is ready. You can sign in with your email and password.
                </p>
                <a
                  href="/sign-in"
                  className="inline-flex items-center justify-center rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] px-4 py-2 text-sm font-medium"
                >
                  Sign in
                </a>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-center">Check your email</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                <Mail className="size-8 text-muted-foreground" />
                <p>
                  We sent a 6-digit verification code to <strong>{registeredEmail}</strong>.
                </p>
                <p>
                  <a
                    href={`/verify-email?email=${encodeURIComponent(registeredEmail)}`}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Enter the code
                  </a>
                  {' to verify your account.'}
                </p>
              </CardContent>
            </Card>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <a href="/sign-in" className="underline underline-offset-2 hover:text-foreground">
              Sign in
            </a>
            {successMethod === 'manual' ? ' after verifying your email.' : ' to get started.'}
          </p>
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
          <span className="text-lg font-semibold tracking-tight text-foreground">el4scloud</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>Choose how to verify and pick your storage tier</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2">
              {tiers.map((tier) => {
                const selected = method === tier.id
                const Icon = tier.icon
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => { setMethod(tier.id); setError('') }}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-[var(--brand)] bg-[var(--brand)]/5'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-[var(--brand)] text-[var(--brand-foreground)]' : 'bg-secondary text-muted-foreground'
                    }`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{tier.title}</div>
                      <div className="text-xs text-muted-foreground">{tier.description}</div>
                    </div>
                    <div className="text-xs font-semibold whitespace-nowrap">{tier.storage}</div>
                  </button>
                )
              })}
            </div>

            {method ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Your name"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input
                    id="confirm"
                    name="confirm"
                    type="password"
                    required
                    placeholder="Repeat your password"
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
                  {loading ? 'Registering...' : 'Register'}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-center text-muted-foreground py-2">
                Select a verification method above to continue.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/sign-in" className="underline underline-offset-2 hover:text-foreground">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
