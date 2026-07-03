import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[mail] RESEND_API_KEY is not set — cannot send email')
    return
  }

  const from = process.env.RESEND_FROM ?? 'noreply@el4s.dev'

  await resend.emails.send({ from, to, subject, html })
}
