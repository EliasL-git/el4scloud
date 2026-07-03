import { Resend } from 'resend'

let resend: Resend | undefined

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[mail] RESEND_API_KEY is not set — cannot send email')
    return
  }

  if (!resend) {
    resend = new Resend(apiKey)
  }

  const from = process.env.RESEND_FROM ?? 'noreply@el4s.dev'

  await resend.emails.send({ from, to, subject, html })
}
