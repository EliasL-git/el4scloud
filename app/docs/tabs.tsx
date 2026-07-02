'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Upload, Download, LifeBuoy, Sparkles } from 'lucide-react'

type Tab = 'overview' | 'upload' | 'download' | 'ai' | 'support'

const tabs: { id: Tab; label: string; icon: typeof BookOpen; file: string }[] = [
  { id: 'overview', label: 'Overview', icon: BookOpen, file: 'overview.md' },
  { id: 'upload', label: 'Upload', icon: Upload, file: 'upload.md' },
  { id: 'download', label: 'Download', icon: Download, file: 'download.md' },
  { id: 'ai', label: 'AI Chat', icon: Sparkles, file: 'ai.md' },
  { id: 'support', label: 'Support', icon: LifeBuoy, file: 'support.md' },
]

export default function DocsTabs({ contents }: { contents: Record<string, string> }) {
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    if (hash && tabs.some((t) => t.id === hash)) {
      setTab(hash)
    }

    const onHashChange = () => {
      const h = window.location.hash.replace('#', '') as Tab
      if (h && tabs.some((t) => t.id === h)) {
        setTab(h)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const activeTab = tabs.find((t) => t.id === tab)!
  const content = contents[activeTab.file]

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Back bar */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to home
            </Link>
            <div className="text-sm font-semibold tracking-tight">Documentation</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-background hidden lg:block">
          <div className="flex flex-col gap-0.5 p-3 sticky top-0">
            <div className="text-xs font-medium text-muted-foreground px-3 py-1.5 uppercase tracking-wider">
              API Reference
            </div>
            {tabs.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`/docs#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  window.location.hash = id
                  setTab(id)
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  tab === id
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </a>
            ))}
          </div>
        </aside>

        {/* Mobile tabs */}
        <div className="lg:hidden w-full overflow-x-auto border-b border-border">
          <div className="flex gap-1 p-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`/docs#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  window.location.hash = id
                  setTab(id)
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  tab === id
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <article className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-hr:border-border prose-li:marker:text-muted-foreground prose-code:text-foreground prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline prose-table:text-sm prose-th:text-foreground prose-td:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </article>
          </div>
        </main>
      </div>
    </div>
  )
}
