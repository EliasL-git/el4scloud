'use client'

import Link from 'next/link'
import { HardDrive, Key, Webhook, MessageSquare, Settings, ArrowRight } from 'lucide-react'

const services = [
  {
    title: 'Storage',
    description: 'Store, manage, and serve your files.',
    href: '/dashboard/storage',
    icon: HardDrive,
  },
  {
    title: 'API Keys',
    description: 'Manage your API keys and access tokens.',
    href: '/dashboard/keys',
    icon: Key,
  },
  {
    title: 'Webhooks',
    description: 'Configure webhook integrations.',
    href: '/dashboard/webhooks',
    icon: Webhook,
  },
  {
    title: 'Support',
    description: 'Contact support and manage tickets.',
    href: '/dashboard/support',
    icon: MessageSquare,
  },
  {
    title: 'Settings',
    description: 'Manage your profile and account.',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

export default function DashboardOverview() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Select a service below to get started.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group relative rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="size-9 rounded-lg bg-secondary flex items-center justify-center mb-3">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Open <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
