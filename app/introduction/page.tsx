'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitIntroduction } from '@/app/actions/introduction'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HardDrive, Loader2, Sparkles, CheckCircle, Clock, Frown, MessageSquare, Mail, LogOut } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

export default function IntroductionPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [approved, setApproved] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockReason, setLockReason] = useState('')

  useEffect(() => {
    if (session?.user) {
      if ((session.user as any).emailVerified) {
        router.push('/dashboard')
      }
    }
  }, [session, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    const result = await submitIntroduction(text)
    setSending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if ((result as any).locked) {
      setLocked(true)
      setLockReason((result as any).reason)
      return
    }
    setApproved(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (locked) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="w-full max-w-md flex flex-col items-center gap-4 text-center">
          <div className="size-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <Clock className="size-7 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Pending Review</h2>
          <p className="text-sm text-muted-foreground">
            Your introduction didn&apos;t pass the automated check:
          </p>
          <p className="text-sm italic text-destructive/80 bg-destructive/5 rounded-lg px-4 py-2">
            {lockReason}
          </p>
          <p className="text-sm text-muted-foreground">
            You are probably here from Slack. If yes, DM{' '}
            <a href="https://hackclub.enterprise.slack.com/team/U08J9R1TUT1" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Elias</a>{' '}
            for verification issues.
          </p>
          <p className="text-sm text-muted-foreground">
            Not from Slack? Then shoot me a message at{' '}
            <a href="mailto:elias.lindholm2010@outlook.com" className="underline underline-offset-2 hover:text-foreground">elias.lindholm2010@outlook.com</a>.
          </p>
          <Button variant="outline" className="gap-2" onClick={() => router.push('/sign-in')}>
            <LogOut className="size-4" />
            Back to sign in
          </Button>
        </div>
      </div>
    )
  }

  if (approved) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
          <CheckCircle className="size-12 text-green-500" />
          <h2 className="text-xl font-semibold tracking-tight">Approved!</h2>
          <p className="text-sm text-muted-foreground">Taking you to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg flex flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
            <HardDrive className="size-4" style={{ color: 'var(--brand-foreground)' }} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">el4scloud</span>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Frown className="size-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">Our mail provider broke :(</CardTitle>
                <CardDescription className="mt-1">
                  We can&apos;t send verification emails right now. Instead, tell us why you want to use this service and an automated system will review it.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs space-y-1.5">
              <p className="font-medium text-foreground">Examples</p>
              <p><span className="text-green-600 dark:text-green-400">Good:</span> &ldquo;I&rsquo;m a student working on a game and need to store assets.&rdquo;</p>
              <p><span className="text-destructive">Bad:</span> &ldquo;give me storage&rdquo;</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Hi, I'm... I'm a... I want to use this for..."
                rows={6}
                maxLength={2000}
                disabled={sending}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground text-right">{text.length} / 2000</p>

              {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}

              <Button
                type="submit"
                disabled={sending || text.trim().length < 50}
                className="w-full"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Reviewing...
                  </>
                ) : (
                  'Submit for review'
                )}
              </Button>
            </form>

            <div className="text-xs text-muted-foreground text-center space-y-1 pt-2 border-t border-border">
              <p>Having issues? Contact us:</p>
              <div className="flex items-center justify-center gap-4">
                <a href="https://hackclub.enterprise.slack.com/team/U08J9R1TUT1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
                  <MessageSquare className="size-3" /> Slack
                </a>
                <a href="mailto:elias.lindholm2010@outlook.com" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
                  <Mail className="size-3" /> Email
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
