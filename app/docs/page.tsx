import fs from 'fs'
import path from 'path'
import ReactMarkdown from 'react-markdown'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function DocsPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'API.md'),
    'utf-8',
  )

  return (
    <div className="min-h-svh bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit"
        >
          <ArrowLeft className="size-3.5" />
          Back to home
        </Link>
        <article className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-hr:border-border prose-li:marker:text-muted-foreground prose-code:text-foreground prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline prose-table:text-sm prose-th:text-foreground prose-td:text-foreground">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
