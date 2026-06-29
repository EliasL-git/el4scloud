'use client'

import { useState } from 'react'
import { register } from '@/app/actions/register'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Mail } from 'lucide-react'

export default function SignUpPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

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

    const result = await register({ name, email, password })
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setRegisteredEmail(email)
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
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-center">Check your email</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <Mail className="size-8 text-muted-foreground" />
              <p>
                We sent a verification link to <strong>{registeredEmail}</strong>.
              </p>
              <p>
                Click the link in the email to verify your account and sign in.
              </p>
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground">
            <a href="/sign-in" className="underline underline-offset-2 hover:text-foreground">
              Sign in
            </a>
            {' after verifying your email.'}
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
            <CardDescription>Sign up with email and password to get started</CardDescription>
          </CardHeader>
          <CardContent>
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
