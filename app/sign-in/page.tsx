'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { FcGoogle } from 'react-icons/fc'

export default function SignInPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'oauth' | 'email'>('oauth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleHackclubSignIn() {
    setLoading(true)
    setError('')
    try {
      await authClient.signIn.oauth2({ providerId: 'hackclub' })
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
      const result = await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(result.error.message || 'Invalid email or password.')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Invalid email or password.')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {mode === 'oauth'
              ? 'Sign in with your Hack Club account'
              : 'Sign in with your email'}
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg border border-zinc-700 p-1">
          <button
            onClick={() => setMode('oauth')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === 'oauth'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Hack Club
          </button>
          <button
            onClick={() => setMode('email')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === 'email'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Email
          </button>
        </div>

        {mode === 'oauth' ? (
          <button
            onClick={handleHackclubSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            <svg viewBox="0 0 200 200" className="h-5 w-5">
              <path
                fill="currentColor"
                d="M 0 0 L 200 0 L 200 200 L 0 200 Z"
              />
            </svg>
            Sign in with Hack Club
          </button>
        ) : (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your password"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-900/50 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500">
          Don&apos;t have an account?{' '}
          <a href="/sign-up" className="text-blue-400 hover:underline">
            Register with an access code
          </a>
        </p>
      </div>
    </div>
  )
}
