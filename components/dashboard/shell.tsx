'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, HardDrive, Key, Webhook, MessageSquare, Settings,
  Menu, X as XIcon, Cloud, ChevronRight, Search, Bell, Terminal,
  HelpCircle, FileText, Plus, MoreHorizontal, Database, FolderOpen, Activity,
  LogOut,
} from 'lucide-react'
import { BroadcastPopup } from '@/components/broadcast-popup'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SuspensionBanner } from '@/components/dashboard/suspension-banner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const sidebarNav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/storage', label: 'Storage', icon: HardDrive },
  { href: '/dashboard/keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dashboard/support', label: 'Support', icon: MessageSquare },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const adminNavItems = [
  { href: '/dashboard/admin', label: 'Admin Overview', icon: LayoutDashboard },
  { href: '/dashboard/admin/requests', label: 'Storage Requests', icon: HardDrive },
  { href: '/dashboard/admin/users', label: 'Users', icon: HardDrive },
  { href: '/dashboard/admin/tickets', label: 'Tickets', icon: MessageSquare },
  { href: '/dashboard/admin/broadcasts', label: 'Broadcasts', icon: MessageSquare },
  { href: '/dashboard/admin/verifications', label: 'Verifications', icon: Settings },
]

interface User {
  id: string
  name: string
  email: string
  image?: string | null
}

export function DashboardShell({
  children,
  user,
  isAdmin = false,
  suspended = false,
  suspensionReason,
  suspensionType,
  appealable,
}: {
  children: React.ReactNode
  user: User
  isAdmin?: boolean
  suspended?: boolean
  suspensionReason?: string
  suspensionType?: 'suspended' | 'terminated' | null
  appealable?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const suspendedAllowedRoutes = ['/dashboard', '/dashboard/support', '/dashboard/settings']
  const isAdminRoute = pathname.startsWith('/dashboard/admin')

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const closeSidebar = () => setSidebarOpen(false)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const navItems = isAdminRoute ? adminNavItems : sidebarNav

  return (
    <div className="min-h-svh bg-background font-sans overflow-hidden">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-[280px] bg-surface-container border-r border-outline-variant/30 flex flex-col py-6 z-50 transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-6 mb-10 flex items-center gap-3">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center">
            <Cloud className="size-5 text-on-primary" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-extrabold text-primary tracking-tight">Hobbycloud</h1>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest opacity-70">Enterprise Tier</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={closeSidebar}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm",
                  active
                    ? "text-primary bg-primary/10 font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface font-medium"
                )}
              >
                <Icon className={cn("size-[22px] shrink-0", active && "fill-primary/10")} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom area */}
        <div className="px-6 py-4 mt-auto border-t border-outline-variant/20">
          <button className="w-full bg-primary text-on-primary py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2">
            <Plus className="size-4" />
            Deploy Instance
          </button>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/dashboard/support" className="flex items-center gap-3 text-on-surface-variant text-sm hover:text-primary transition-colors" onClick={closeSidebar}>
              <HelpCircle className="size-[18px]" />
              <span>Support</span>
            </Link>
            <a href="/docs" className="flex items-center gap-3 text-on-surface-variant text-sm hover:text-primary transition-colors">
              <FileText className="size-[18px]" />
              <span>Documentation</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 right-0 w-[calc(100%-280px)] h-16 bg-surface-glass backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-10 z-40">
        <div className="flex items-center gap-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-on-surface-variant hover:text-on-surface mr-2">
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 text-on-surface-variant font-mono text-xs">
            <span className="opacity-70">Projects</span>
            <ChevronRight className="size-3.5 opacity-50" />
            <span className="text-on-surface font-bold">Default Project</span>
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant size-[20px] opacity-60" />
            <input
              className="bg-surface-container-highest/50 border border-outline-variant/30 rounded-2xl pl-11 pr-4 py-2 text-sm w-80 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-on-surface placeholder:text-on-surface-variant/40"
              placeholder="Search resources..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-full transition-all">
              <Bell className="size-5" />
            </button>
            <button className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-full transition-all">
              <Terminal className="size-5" />
            </button>
          </div>
          <div className="h-6 w-px bg-outline-variant/30" />
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <div className="flex items-center gap-3 pl-2 cursor-pointer">
                <Avatar className="size-9 ring-2 ring-primary/20 p-0.5">
                  <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden lg:block">
                  <p className="text-sm font-bold leading-none text-on-surface">{user.name}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1 font-medium opacity-60">Console Root</p>
                </div>
              </div>
            } />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive gap-2 cursor-pointer">
                <LogOut className="size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="ml-[280px] mt-16 p-10 h-[calc(100vh-64px)] overflow-y-auto">
        {suspended && !suspendedAllowedRoutes.includes(pathname) && !isAdminRoute ? (
          <SuspensionBanner reason={suspensionReason ?? 'Account suspended'} appealable={appealable} suspensionType={suspensionType ?? undefined} />
        ) : (
          children
        )}

        {/* Atmosphere blobs */}
        <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="fixed bottom-1/4 right-1/4 w-[600px] h-[600px] bg-success-primary/5 blur-[180px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      </main>

      {/* Footer status bar */}
      <footer className="fixed bottom-0 right-0 w-[calc(100%-280px)] h-8 bg-surface-container-lowest border-t border-outline-variant/20 flex items-center justify-between px-10 z-30">
        <div className="flex items-center gap-4 text-[10px] font-mono text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success-primary glow-status animate-pulse" />
            <span className="font-bold tracking-widest">SYSTEM STATUS: OPERATIONAL</span>
          </div>
          <div className="h-3 w-px bg-outline-variant/30" />
          <span className="opacity-60">&copy; 2024 Hobbycloud Infrastructure</span>
        </div>
        <div className="flex items-center gap-6 text-[10px] font-mono text-on-surface-variant">
          <a className="hover:text-primary transition-colors opacity-70" href="#">Privacy Policy</a>
          <a className="hover:text-primary transition-colors opacity-70" href="#">Terms of Service</a>
          <a className="hover:text-primary transition-colors opacity-70" href="#">API Status</a>
        </div>
      </footer>

      <BroadcastPopup />
    </div>
  )
}
