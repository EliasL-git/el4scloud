import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  HardDrive,
  Zap,
  Lock,
  Globe,
  Key,
  ArrowRight,
  CloudUpload,
  Code2,
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Blazing fast uploads',
    desc: 'Presigned URLs let clients upload directly to storage — no proxying through your server.',
  },
  {
    icon: Globe,
    title: 'CDN-ready URLs',
    desc: 'Public files get a clean CDN URL you can use anywhere — images, videos, assets.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    desc: 'Files are private unless you explicitly make them public. You stay in control.',
  },
  {
    icon: Key,
    title: 'API key auth',
    desc: 'Generate scoped API keys for programmatic access from your CI, backend, or scripts.',
  },
  {
    icon: Code2,
    title: 'Simple REST API',
    desc: 'One endpoint. POST file metadata, get a presigned URL, PUT the bytes.',
  },
  {
    icon: HardDrive,
    title: 'S3-compatible',
    desc: 'S3-compatible object storage, built for reliability.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="size-7 rounded-md flex items-center justify-center"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              <HardDrive className="size-3.5" style={{ color: 'var(--brand-foreground)' }} />
            </div>
            <span className="text-sm font-semibold tracking-tight">el4scloud</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/sign-in">
              <Button
                size="sm"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
              >
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 gap-6">
        <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1">
          <span
            className="size-1.5 rounded-full inline-block"
            style={{ backgroundColor: 'var(--brand)' }}
          />
          S3-compatible object storage
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance max-w-2xl leading-tight">
          Cloud storage that gets out of your way
        </h1>

        <p className="text-base text-muted-foreground max-w-lg text-pretty leading-relaxed">
          Upload, manage, and serve files with a clean dashboard and a dead-simple REST API.
          Built for developers who want S3 without the complexity.
        </p>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Link href="/sign-in">
            <Button
              size="lg"
              className="gap-2"
              style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}
            >
              <CloudUpload className="size-4" data-icon="inline-start" />
              Start uploading free
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>

        {/* Code snippet */}
        <div className="mt-4 w-full max-w-xl text-left">
          <pre className="text-xs bg-secondary border border-border rounded-xl p-4 overflow-x-auto font-mono leading-relaxed text-muted-foreground whitespace-pre">
            <span className="text-foreground">{'// Upload a file in 2 steps'}</span>{'\n'}
            <span style={{ color: 'var(--brand)' }}>const</span>{' res = await fetch(\'https://yourapp.com/api/upload\', {\n'}
            {'  method: \'POST\',\n'}
            {'  headers: { Authorization: `Bearer ${apiKey}` },\n'}
            {'  body: JSON.stringify({ fileName, mimeType, size }),\n'}
            {'});\n\n'}
            <span style={{ color: 'var(--brand)' }}>await</span>{' fetch(res.presignedUrl, { method: \'PUT\', body: file });'}
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-center mb-12 text-balance">
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card"
              >
                <div
                  className="size-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--brand-muted)' }}
                >
                  <Icon className="size-4" style={{ color: 'var(--brand)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className="size-5 rounded flex items-center justify-center"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              <HardDrive className="size-3" style={{ color: 'var(--brand-foreground)' }} />
            </div>
            <span className="text-xs text-muted-foreground font-medium">el4scloud</span>
          </div>
          <p className="text-xs text-muted-foreground">S3-compatible object storage</p>
        </div>
      </footer>
    </div>
  )
}
