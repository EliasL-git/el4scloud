'use client'

import { useState, useEffect } from 'react'
import { getAdminAiUsage } from '@/app/actions/ai'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Cpu, Hash, Trophy } from 'lucide-react'

function formatUsd(n: number): string {
  if (n < 0.0001) return '$0.0000'
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

interface UsageRow {
  userId: string
  name: string
  email: string
  requests: number
  spent: number
  tokens: number
  mostUsedModel: string | null
  mostUsedModelRequests: number
  globalMostUsedModel: string | null
  globalMostUsedModelRequests: number
}

export default function AdminAIPage() {
  const [rows, setRows] = useState<UsageRow[]>([])

  useEffect(() => {
    getAdminAiUsage().then(setRows)
  }, [])

  const totalSpent = rows.reduce((acc, r) => acc + r.spent, 0)
  const totalRequests = rows.reduce((acc, r) => acc + r.requests, 0)
  const totalTokens = rows.reduce((acc, r) => acc + r.tokens, 0)
  const topModel = rows[0]?.globalMostUsedModel
    ? [rows[0].globalMostUsedModel, rows[0].globalMostUsedModelRequests] as const
    : undefined

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI Usage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Daily spend across all Hack Club users</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Spent Today</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">{formatUsd(totalSpent)}</p>
              </div>
              <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                <DollarSign className="size-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Requests Today</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">{totalRequests}</p>
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
                <p className="text-xs text-muted-foreground">Tokens Used Today</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">{totalTokens.toLocaleString()}</p>
              </div>
              <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                <Hash className="size-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Most Used Model</p>
                <p className="text-lg font-semibold tracking-tight mt-1 truncate">{topModel?.[0] ?? '—'}</p>
                {topModel && <p className="text-xs text-muted-foreground">{topModel[1]} request{topModel[1] === 1 ? '' : 's'}</p>}
              </div>
              <div className="size-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Trophy className="size-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium text-right">Requests</th>
                <th className="p-3 font-medium text-right">Tokens</th>
                <th className="p-3 font-medium">Most Used Model</th>
                <th className="p-3 font-medium text-right">Spent</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={6}>No usage yet today</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{r.name || 'Unknown'}</td>
                  <td className="p-3 text-muted-foreground">{r.email}</td>
                  <td className="p-3 text-right tabular-nums">{r.requests}</td>
                  <td className="p-3 text-right tabular-nums">{r.tokens.toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground">{r.mostUsedModel ? `${r.mostUsedModel} (${r.mostUsedModelRequests})` : '—'}</td>
                  <td className="p-3 text-right tabular-nums">{formatUsd(r.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
