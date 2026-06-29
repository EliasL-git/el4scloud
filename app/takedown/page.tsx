'use client'

import { useState } from 'react'
import Link from 'next/link'
import { submitTakedownRequest } from '@/app/actions/takedown'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const REASONS = [
  { value: "I don't like it.", label: "I don't like it." },
  { value: 'This is my content and they are uploading it without my permission', label: 'This is my content and they are uploading it without my permission' },
  { value: 'This is illegal in the EU', label: 'This is illegal in the EU' },
  { value: 'This is illegal in my country', label: 'This is illegal in my country' },
  { value: 'This contains malware or malicious code', label: 'This contains malware or malicious code' },
  { value: 'This contains hate speech or harassment', label: 'This contains hate speech or harassment' },
  { value: 'This is sexually explicit and I am a minor in it', label: 'This is sexually explicit and I am a minor in it' },
  { value: 'Other legal reason', label: 'Other legal reason' },
] as const

const MY_CONTENT_REASON = 'This is my content and they are uploading it without my permission'

export default function TakedownPage() {
  const [fileUrl, setFileUrl] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [reason, setReason] = useState('')
  const [originalUrl, setOriginalUrl] = useState('')
  const [originalDate, setOriginalDate] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const showMyContentFields = reason === MY_CONTENT_REASON

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const details: Record<string, string> = {}
    if (originalUrl) details.originalUrl = originalUrl
    if (originalDate) details.originalDate = originalDate
    if (additionalInfo) details.additionalInfo = additionalInfo

    const result = await submitTakedownRequest({
      fileUrl: fileUrl.trim(),
      reporterName: reporterName.trim(),
      reporterEmail: reporterEmail.trim(),
      reason: reason.trim(),
      details: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="size-5 text-amber-500" />
            </div>
            <CardTitle className="mb-2">Report Submitted</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Your takedown request has been submitted and will be reviewed by an admin.
              We&apos;ll follow up at <strong className="text-foreground">{reporterEmail}</strong> if needed.
            </CardDescription>
            <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline mt-4 inline-block">
              Back to home
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShieldAlert className="size-4 text-amber-500" />
            </div>
            <div>
              <CardTitle>Takedown Request</CardTitle>
              <CardDescription>Report a file hosted on el4scloud</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fileUrl">File URL</Label>
              <Input
                id="fileUrl"
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                required
                placeholder="https://cloud.el4s.dev/api/proxy/..."
              />
              <p className="text-xs text-muted-foreground">
                Paste the full URL of the file you want to report
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reporterName">Your Name</Label>
              <Input
                id="reporterName"
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reporterEmail">Your Email</Label>
              <Input
                id="reporterEmail"
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Reason for Takedown</legend>
              <div className="flex flex-col gap-2">
                {REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      reason === r.value
                        ? 'border-amber-500 bg-amber-500/5'
                        : 'border-border bg-card hover:bg-secondary/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      className="mt-0.5 accent-amber-500 shrink-0"
                      required
                    />
                    <span className="text-sm text-foreground">{r.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {showMyContentFields && (
              <div className="flex flex-col gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                <p className="text-xs font-medium text-amber-500 uppercase tracking-wider">
                  Proof of Ownership
                </p>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="originalUrl">It was posted first at</Label>
                  <Input
                    id="originalUrl"
                    type="url"
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    placeholder="https://example.com/your-content"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL where you originally posted this content
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="originalDate">Date of original publication</Label>
                  <Input
                    id="originalDate"
                    type="date"
                    value={originalDate}
                    onChange={(e) => setOriginalDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="additionalInfo">Additional information</Label>
                  <textarea
                    id="additionalInfo"
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder="Any other evidence or context..."
                    rows={3}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-1.5"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              {loading ? 'Submitting...' : 'Submit Takedown Request'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline mt-4 inline-flex items-center gap-1.5">
        <ArrowLeft className="size-3.5" />
        Back to home
      </Link>
    </div>
  )
}
