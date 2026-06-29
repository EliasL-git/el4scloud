'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [invalidToken, setInvalidToken] = useState(!token)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      const result = await authClient.resetPassword({
        token: token!,
        newPassword: password,
      })
      if (result.error) {
        if (result.error.code === 'INVALID_TOKEN') {
          setInvalidToken(true)
        } else {
          setError(result.error.message || 'Failed to reset password.')
        }
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Failed to reset password.')
    }
    setLoading(false)
  }

  if (invalidToken) {
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
              <CardTitle className="text-xl flex items-center gap-2">
                <AlertCircle className="size-5 text-destructive" />
                Invalid or expired link
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                This password reset link is invalid or has expired.
              </p>
              <Button
                onClick={() => router.push('/forgot-password')}
                className="w-full"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                Request a new reset link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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

          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600" />
                Password reset
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Your password has been reset successfully.
              </p>
              <Button
                onClick={() => router.push('/sign-in')}
                className="w-full"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                Sign in with your new password
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
          <span className="text-lg font-semibold tracking-tight text-foreground">el4scloud</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Set new password</CardTitle>
            <CardDescription>
              Enter your new password below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Lock className="size-4" />
                )}
                Reset password
              </Button>
            </form>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
