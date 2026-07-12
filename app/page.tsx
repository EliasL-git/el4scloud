import Link from 'next/link'
import {
  HardDrive, Zap, Lock, Globe, Key, ArrowRight, CloudUpload, Code2, Cloud,
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Blazing fast uploads',
    desc: 'Upload files directly via multipart POST. No need for presigned URLs or complex SDKs.',
  },
  {
    icon: Globe,
    title: 'CDN-ready URLs',
    desc: 'Public files get a clean proxy URL you can use anywhere — images, videos, assets.',
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
    desc: 'One POST endpoint with multipart form-data. Upload, get back file metadata.',
  },
  {
    icon: HardDrive,
    title: 'Reliable storage',
    desc: 'Store and serve your files with confidence.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-on-surface font-sans flex flex-col overflow-hidden relative">

      {/* Atmosphere blobs */}
      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="fixed bottom-1/4 right-1/4 w-[600px] h-[600px] bg-success-primary/5 blur-[180px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />

      {/* Nav */}
      <header className="border-b border-outline-variant/30 bg-surface-glass backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <Cloud className="size-3.5 text-on-primary" fill="currentColor" />
            </div>
            <span className="text-sm font-heading font-extrabold text-primary tracking-tight">Hobbycloud</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs">
              <button className="px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-highest">
                Docs
              </button>
            </Link>
            <Link href="/sign-in">
              <button className="px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-highest">
                Sign in
              </button>
            </Link>
            <Link href="/sign-up">
              <button className="px-4 py-1.5 text-sm font-bold bg-primary text-on-primary rounded-xl hover:shadow-[0_0_20px_rgba(213,227,255,0.25)] transition-all active:scale-95">
                Get started
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 gap-8">
        <div className="glass-card rounded-2xl p-12 sm:p-16 max-w-3xl w-full border-primary/10">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Cloud className="size-7 text-primary" fill="currentColor" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight text-balance max-w-2xl leading-tight text-on-surface mx-auto">
            Cloud storage that gets out of your way
          </h1>
          <p className="text-base text-on-surface-variant max-w-lg text-pretty leading-relaxed mx-auto mt-4">
            Upload, manage, and serve files with a clean dashboard and a dead-simple REST API.
            Built for developers who want S3 without the complexity.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center mt-8">
            <Link href="/sign-up">
              <button className="px-8 py-3.5 bg-primary text-on-primary rounded-2xl font-bold hover:shadow-[0_0_20px_rgba(213,227,255,0.25)] transition-all active:scale-95 text-sm inline-flex items-center gap-2">
                <CloudUpload className="size-4" />
                Start uploading free
                <ArrowRight className="size-4" />
              </button>
            </Link>
            <Link href="/sign-in">
              <button className="px-8 py-3.5 border border-primary/40 text-primary rounded-2xl font-bold hover:bg-primary/5 transition-all active:scale-95 text-sm">
                Sign in
              </button>
            </Link>
            <Link href="/docs">
              <button className="px-8 py-3.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
                Read the docs
              </button>
            </Link>
          </div>
        </div>

        {/* Code snippet */}
        <div className="w-full max-w-2xl">
          <pre className="text-xs bg-surface-container border border-outline-variant/30 rounded-xl p-4 overflow-x-auto font-mono leading-relaxed text-on-surface-variant whitespace-pre">
            <span style={{ color: 'var(--primary)' }}>curl</span> https://cloud.el4s.dev/api/upload {'\\'}
            {'  '}-H "Authorization: Bearer sk_..." {'\\'}
            {'  '}-F "file=@photo.jpg" {'\\'}
            {'  '}-F "isPublic=true"
          </pre>
          <pre className="text-xs bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 overflow-x-auto font-mono leading-relaxed text-on-surface-variant whitespace-pre mt-2">
            <span className="text-on-surface">{'// Response'}</span>{'\n'}
            {'{'}{'\n'}
            {'  "fileId": "550e8400-...",'}{'\n'}
            {'  "key": "userId/550e8400-....jpg",'}{'\n'}
            {'  "name": "photo.jpg",'}{'\n'}
            {'  "size": 204800,'}{'\n'}
            {'  "mimeType": "image/jpeg",'}{'\n'}
            {'  "isPublic": true,'}{'\n'}
            {'  "scanStatus": "pending"'}{'\n'}
            {'}'}
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-outline-variant/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-2xl font-heading font-bold tracking-tight text-center mb-12 text-balance text-on-surface">
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="glass-card rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">{title}</p>
                  <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant/30 bg-surface-container-lowest">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-primary flex items-center justify-center">
              <Cloud className="size-3 text-on-primary" fill="currentColor" />
            </div>
            <span className="text-xs font-mono text-on-surface-variant font-medium">Hobbycloud</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-xs text-on-surface-variant hover:text-primary transition-colors">
              API docs
            </Link>
            <p className="text-xs text-on-surface-variant/60 font-mono">Cloud storage</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
