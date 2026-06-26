'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerWithAccessCode } from '@/app/actions/register'

export default function SignUpPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const code = form.get('code') as string
    const name = form.get('name') as string
    const email = form.get('email') as string
    const password = form.get('password') as string
    const confirm = form.get('confirm') as string

    if (!code || !name || !email || !password) {
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

    const result = await registerWithAccessCode({ code, name, email, password })
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h1 className="text-2xl font-bold text-green-400">Account Created!</h1>
          <p className="text-zinc-400">Redirecting you to the dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Register</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Enter your access code to create an account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Access Code</label>
            <input
              name="code"
              type="text"
              required
              placeholder="XXXX-XXXX-XXXX"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="Your name"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Confirm Password</label>
            <input
              name="confirm"
              type="password"
              required
              placeholder="Repeat your password"
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
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <a href="/sign-in" className="text-blue-400 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
