'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { register } from '@/app/actions/register'
import { authClient } from '@/lib/auth-client'
import { Cloud, Mail, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function SignUpPage() {
  const router = useRouter()
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

    const signInResult = await authClient.signIn.email({ email, password })
    if (signInResult.error) {
      console.error('[signup] Auto sign-in failed:', signInResult.error)
    }
  }

  if (success) {
    return (
      <div className="relative min-h-svh flex items-center justify-center bg-background px-4 overflow-hidden">

        <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="fixed bottom-1/4 right-1/4 w-[600px] h-[600px] bg-success-primary/5 blur-[180px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />

        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/10">
              <Cloud className="size-6 text-on-primary" fill="currentColor" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-heading font-extrabold text-primary tracking-tight">Hobbycloud</h1>
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest opacity-70">Enterprise Tier</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-8 text-center">
            <h2 className="text-xl font-heading font-bold text-on-surface mb-4">Check your email</h2>
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="size-6 text-primary" />
              </div>
              <p className="text-sm text-on-surface-variant">
                We sent a 6-digit verification code to <strong className="text-on-surface">{registeredEmail}</strong>.
              </p>
              <p className="text-sm text-on-surface-variant">
                <Link
                  href={`/verify-email?email=${encodeURIComponent(registeredEmail)}`}
                  className="underline underline-offset-2 hover:text-primary font-medium"
                >
                  Enter the code
                </Link>
                {' to verify your account.'}
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-on-surface-variant">
            <Link href="/sign-in" className="underline underline-offset-2 hover:text-primary">
              Sign in after verifying your email.
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh flex items-center justify-center bg-background px-4 overflow-hidden">

      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="fixed bottom-1/4 right-1/4 w-[600px] h-[600px] bg-success-primary/5 blur-[180px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />

      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="size-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/10">
            <Cloud className="size-6 text-on-primary" fill="currentColor" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-heading font-extrabold text-primary tracking-tight">Hobbycloud</h1>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest opacity-70">Enterprise Tier</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-xl font-heading font-bold text-on-surface mb-1">Create your account</h2>
          <p className="text-sm text-on-surface-variant mb-6">Enter your details to get started. You&apos;ll need to verify your email.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Your name"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Confirm Password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                placeholder="Repeat your password"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {error && (
              <p className="text-sm text-error-red font-medium" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(213,227,255,0.25)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Register'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-variant">
          Already have an account?{' '}
          <Link href="/sign-in" className="underline underline-offset-2 hover:text-primary font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
