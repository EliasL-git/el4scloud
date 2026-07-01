import nodemailer from 'nodemailer'

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.MAILCOW_HOST,
    port: Number(process.env.MAILCOW_PORT) || 587,
    secure: Number(process.env.MAILCOW_PORT) === 465,
    auth: {
      user: process.env.MAILCOW_USER,
      pass: process.env.MAILCOW_PASS,
    },
  })
}

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (!process.env.MAILCOW_HOST) return

  const transporter = getTransport()
  await transporter.sendMail({
    from: process.env.MAILCOW_FROM ?? process.env.MAILCOW_USER,
    to,
    subject,
    html,
  })
}
