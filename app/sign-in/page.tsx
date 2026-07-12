'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { resendVerificationEmail } from '@/app/actions/verify'
import { Cloud, Mail, MailCheck, Loader2, ChevronRight } from 'lucide-react'
import Link from 'next/link'

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
    <div className="relative min-h-svh flex items-center justify-center bg-background px-4 overflow-hidden">

      {/* Atmosphere blobs */}
      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="fixed bottom-1/4 right-1/4 w-[600px] h-[600px] bg-success-primary/5 blur-[180px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />

      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
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
          <h2 className="text-xl font-heading font-bold text-on-surface mb-1">Sign in</h2>
          <p className="text-sm text-on-surface-variant mb-6">Sign in with your email</p>

          <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your password"
                className="w-full bg-surface-container-highest/50 border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <div className="flex justify-end -mt-0.5">
                <a href="/forgot-password" className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-2 transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>

            {error && !needsVerification && (
              <p className="text-sm text-error-red font-medium" role="alert">
                {error}
              </p>
            )}

            {needsVerification ? (
              <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container p-4">
                <div className="flex items-start gap-2">
                  <Mail className="size-4 text-on-surface-variant shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-on-surface">Email not verified</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      A 6-digit code was sent to your email.{' '}
                      <a href={`/verify-email?email=${encodeURIComponent(needsVerification)}`} className="underline underline-offset-2 hover:text-primary">
                        Enter it here
                      </a>
                      , or resend below.
                    </p>
                  </div>
                </div>
                {resent ? (
                  <div className="flex items-center gap-2 text-xs text-success-primary font-medium">
                    <MailCheck className="size-3.5 shrink-0" />
                    Verification email sent!
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="w-full px-4 py-2.5 border border-outline-variant/30 text-on-surface-variant rounded-xl font-bold text-sm hover:bg-surface-container-highest transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {resending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Mail className="size-3.5" />
                    )}
                    Resend verification email
                  </button>
                )}
                <a
                  href={`/verify-email?email=${encodeURIComponent(needsVerification)}`}
                  className="text-xs text-center text-on-surface-variant underline underline-offset-2 hover:text-primary"
                >
                  Already have a code? Enter it here
                </a>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(213,227,255,0.25)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            )}
          </form>
        </div>

        <div className="flex flex-col items-center gap-2 text-sm text-on-surface-variant">
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="underline underline-offset-2 hover:text-primary font-medium">
              Create an account
            </Link>
          </p>
          <p>
            <Link href="/verify-email" className="underline underline-offset-2 hover:text-primary">
              Resend verification email
            </Link>
          </p>
          <div className="flex items-center gap-4 pt-2 text-xs font-mono">
            <Link href="/legal" className="underline underline-offset-2 hover:text-primary">Terms</Link>
            <Link href="/security" className="underline underline-offset-2 hover:text-primary">Security</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
