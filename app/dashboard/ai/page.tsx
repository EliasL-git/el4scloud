'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { getAiUsage, getAiModels, getConversations, getConversation, createConversation, deleteConversation } from '@/app/actions/ai'
import { Sparkles, Send, Loader2, Terminal, Bot, User, RefreshCw, MessageSquare, CreditCard, Cpu, BarChart3, LayoutDashboard, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'chat' | 'usage'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Model {
  id: string
  name: string
  provider: string
}

interface UsageData {
  hasAccess: boolean
  usedToday: number
  limit: number
  requestCount?: number
}

function formatUsd(n: number): string {
  if (n < 0.0001) return '$0.0000'
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

export default function AIPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('deepseek-4-flash')
  const [error, setError] = useState('')
  const [fallbackNotice, setFallbackNotice] = useState('')
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; messageCount: number }>>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const requestCount = usage?.requestCount ?? 0
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    getAiUsage().then(setUsage)
    getAiModels().then(setModels)
    loadConversations()
  }, [])

  const loadConversations = async () => {
    const convs = await getConversations()
    setConversations(convs)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending || !usage?.hasAccess) return

    setInput('')
    setError('')
    setFallbackNotice('')
    const userMessage: Message = { role: 'user', content }
    const assistantMessage: Message = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setSending(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
          stream: true,
          conversation_id: conversationId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(err.error || `Error ${res.status}`)
        setMessages((prev) => prev.slice(0, -1))
        setSending(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed._meta) {
              setUsage((prev) => prev ? { ...prev, usedToday: parsed._usedToday, requestCount: (prev.requestCount ?? 0) + 1 } : prev)
              const parts: string[] = []
              if (parsed._fallback && parsed._fallbackFrom && parsed._model) {
                const fromName = models.find((m: Model) => m.id === parsed._fallbackFrom)?.name ?? parsed._fallbackFrom
                const toName = models.find((m: Model) => m.id === parsed._model)?.name ?? parsed._model
                parts.push(`${fromName} overloaded. Used ${toName}.`)
              }
              if (parsed._cost) parts.push(formatUsd(parsed._cost))
              if (parts.length) setFallbackNotice(parts.join(' '))
              continue
            }
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + delta }
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Network error')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleNewChat = async () => {
    if (abortRef.current) abortRef.current.abort()
    try {
      const conv = await createConversation('New chat')
      setConversationId(conv.id)
      setMessages([]); setError(''); setFallbackNotice(''); setInput('')
      await loadConversations()
    } catch {}
  }

  const handleSelectConversation = async (id: string) => {
    if (abortRef.current) abortRef.current.abort()
    try {
      const conv = await getConversation(id)
      setConversationId(conv.id)
      setMessages(conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })))
      setError(''); setFallbackNotice(''); setInput('')
    } catch {}
  }

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id)
    if (conversationId === id) {
      setConversationId(null)
      setMessages([])
    }
    await loadConversations()
  }

  if (usage === null) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  if (!usage.hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-md mx-auto text-center">
        <div className="size-14 rounded-xl bg-secondary flex items-center justify-center">
          <Terminal className="size-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Hack Club students only</h2>
        <p className="text-sm text-muted-foreground">Free AI access is available exclusively to Hack Club students. Link your Hack Club account in Settings.</p>
        <a href="/dashboard/settings"><Button>Go to Settings</Button></a>
      </div>
    )
  }

  const budgetPercent = Math.round((usage.usedToday / usage.limit) * 100)

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden lg:block">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="size-5" />
          AI Chat
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Free for Hack Club students</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-0.5 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors shrink-0',
              tab === id
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && (
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Requests Today</p>
                    <p className="text-2xl font-semibold tracking-tight mt-1">{requestCount}</p>
                  </div>
                  <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                    <MessageSquare className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Spent Today</p>
                    <p className="text-2xl font-semibold tracking-tight mt-1">{formatUsd(usage.usedToday)}</p>
                  </div>
                  <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                    <CreditCard className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Models Available</p>
                    <p className="text-2xl font-semibold tracking-tight mt-1">{models.length}</p>
                  </div>
                  <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Cpu className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Daily Budget</p>
                    <p className="text-2xl font-semibold tracking-tight mt-1">{formatUsd(usage.limit)}</p>
                  </div>
                  <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                    <BarChart3 className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-3">Available Models</h3>
                <div className="space-y-2">
                  {models.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.provider}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => { setSelectedModel(m.id); setTab('chat') }}
                      >
                        Open
                        <ChevronRight className="size-3 ml-0.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-3">Daily Budget Usage</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(budgetPercent, 100)}%`,
                        backgroundColor: budgetPercent > 80 ? 'var(--destructive)' : 'var(--brand)',
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-medium">{formatUsd(usage.usedToday)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-medium">{formatUsd(Math.max(0, usage.limit - usage.usedToday))}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daily Limit</span>
                    <span className="font-medium">{formatUsd(usage.limit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requests</span>
                    <span className="font-medium">{requestCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ===== CHAT ===== */}
      {tab === 'chat' && (
        <section className="flex flex-col gap-4">
          <Card className="flex-1 flex flex-col">
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  {models.length > 0 && (
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="text-xs rounded-md border border-input bg-background px-2 py-1.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleNewChat} className="gap-1.5 text-xs">
                    <Plus className="size-3.5" />
                    New chat
                  </Button>
                </div>
              </div>

              <Separator />

              {conversations.length > 0 && (
                <div className="px-4 py-2 flex gap-2 overflow-x-auto border-b border-border">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConversation(c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors shrink-0 ${conversationId === c.id ? 'border-foreground/40 bg-secondary' : 'border-border hover:bg-secondary/50'}`}
                    >
                      <span className="truncate max-w-[120px]">{c.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c.id) }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </button>
                  ))}
                </div>
              )}

              <Separator />

              <div className="flex-1 overflow-y-auto space-y-4 p-4 min-h-[350px] max-h-[450px]">
                {messages.length === 0 && !sending ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <div className="size-14 rounded-xl bg-secondary flex items-center justify-center">
                      <Sparkles className="size-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Ask anything</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Select a model above and start chatting</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isLastAssistant = sending && i === messages.length - 1 && msg.role === 'assistant'
                    const displayContent = isLastAssistant && msg.content === ''
                      ? '\u200B'
                      : msg.content.replace(/^\s+/gm, '').replace(/\n{3,}/g, '\n\n')
                    return (
                      <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                        <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-secondary' : 'bg-[var(--brand)]'}`}>
                          {msg.role === 'assistant' ? <Bot className="size-4 text-muted-foreground" /> : <User className="size-4 text-[var(--brand-foreground)]" />}
                        </div>
                        <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'assistant' ? (isLastAssistant ? 'bg-secondary/50 border border-border' : 'bg-secondary/50 border border-border') : 'bg-[var(--brand)] text-[var(--brand-foreground)]'}`}>
                          {displayContent}
                          {isLastAssistant && (
                            <span className="inline-block w-[2px] h-[1em] bg-foreground/70 ml-0.5 align-text-bottom animate-pulse" />
                          )}
                        </div>
                      </div>
                    )
                  })
                )}

                <div ref={messagesEndRef} />
              </div>

              {fallbackNotice && (
                <div className="mx-4 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {fallbackNotice}
                </div>
              )}

              {error && (
                <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Separator />

              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(budgetPercent, 100)}%`, backgroundColor: budgetPercent > 80 ? 'var(--destructive)' : 'var(--brand)' }} />
                  </div>
                  <span className="shrink-0 tabular-nums">{formatUsd(usage.usedToday)} / {formatUsd(usage.limit)}</span>
                </div>

                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    rows={2}
                    disabled={sending}
                    className="flex-1 min-h-[44px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-50"
                  />
                  <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon" className="shrink-0 self-end" style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-foreground)' }}>
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ===== USAGE ===== */}
      {tab === 'usage' && (
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total Spent Today</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">{formatUsd(usage.usedToday)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Daily Budget Remaining</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">{formatUsd(Math.max(0, usage.limit - usage.usedToday))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Requests Made</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">{requestCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-3">Budget Usage</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(budgetPercent, 100)}%`, backgroundColor: budgetPercent > 80 ? 'var(--destructive)' : 'var(--brand)' }} />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{formatUsd(usage.usedToday)}</span> of {formatUsd(usage.limit)} used today
              </div>
              <div className="text-xs text-muted-foreground mt-1">Resets at midnight UTC &middot; pay-per-token pricing via DigitalOcean</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-3">Pricing</h3>
              <div className="space-y-3">
                {models.map((m) => {
                  const p = m as any
                  return (
                    <div key={m.id} className="rounded-lg border border-border p-3">
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>${(p.inputPricePer1M ?? 0).toFixed(3)} / 1M input tokens</div>
                        <div>${(p.outputPricePer1M ?? 0).toFixed(3)} / 1M output tokens</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}
