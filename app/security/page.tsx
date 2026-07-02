import fs from 'fs'
import path from 'path'
import ReactMarkdown from 'react-markdown'
import { BackButton } from '@/components/back-button'

export default function SecurityPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), 'security', 'security.md'),
    'utf-8',
  )

  return (
    <div className="min-h-svh bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <BackButton />
        <article className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-hr:border-border prose-li:marker:text-muted-foreground">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
