import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
// Trigger one-time recovery of pending scans at server startup
import '@/lib/scan-recovery-init'

const headingFont = Plus_Jakarta_Sans({
  variable: '--font-heading',
  subsets: ['latin'],
})

const bodyFont = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

const monoFont = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Hobbycloud Console — Project Resources',
  description: 'Orchestrate your high-performance infrastructure from a single unified command center.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: 'black',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
