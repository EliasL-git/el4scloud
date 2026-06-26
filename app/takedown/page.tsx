'use client'

import { useState } from 'react'
import Link from 'next/link'
import { submitTakedownRequest } from '@/app/actions/takedown'
import { ShieldAlert } from 'lucide-react'

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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <ShieldAlert className="size-10 mx-auto text-amber-400 mb-4" />
          <h1 className="text-xl font-bold text-white">Report Submitted</h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Your takedown request has been submitted and will be reviewed by an admin.
            We&apos;ll follow up at <strong className="text-zinc-300">{reporterEmail}</strong> if needed.
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            <Link href="/" className="text-blue-400 hover:underline">Back to home</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-lg space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <ShieldAlert className="size-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Takedown Request</h1>
            <p className="text-sm text-zinc-400">
              Report a file hosted on el4scloud
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">File URL</label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              required
              placeholder="https://cloud.el4s.dev/api/proxy/..."
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Paste the full URL of the file you want to report
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Your Name</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="John Doe"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Your Email</label>
            <input
              type="email"
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Reason for Takedown</label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                    reason === r.value
                      ? 'border-amber-600 bg-amber-600/10'
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-0.5 accent-amber-500"
                    required
                  />
                  <span className="text-sm text-zinc-300">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {showMyContentFields && (
            <div className="space-y-3 rounded-md border border-zinc-700 bg-zinc-800/50 p-4">
              <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                Proof of Ownership
              </p>
              <div>
                <label className="block text-sm text-zinc-300">
                  It was posted first at
                </label>
                <input
                  type="url"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  placeholder="https://example.com/your-content"
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  URL where you originally posted this content
                </p>
              </div>
              <div>
                <label className="block text-sm text-zinc-300">
                  Date of original publication
                </label>
                <input
                  type="date"
                  value={originalDate}
                  onChange={(e) => setOriginalDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300">
                  Additional information
                </label>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Any other evidence or context..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-900/50 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Takedown Request'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500">
          <Link href="/" className="text-blue-400 hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
