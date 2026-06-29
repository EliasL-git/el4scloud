'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Files, Key, LogOut, HardDrive, Shield, MessageSquare, Settings, Menu, X as XIcon, LayoutDashboard, FileText, Scale, ShieldAlert, Trash2, ClipboardList, Users } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StorageRequestDialog } from '@/components/dashboard/storage-request-dialog'
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

const navItems = [
  { href: '/dashboard', label: 'Files', icon: Files },
  { href: '/dashboard/keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/support', label: 'Support', icon: MessageSquare },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const adminNavItems = [
  { href: '/dashboard/admin', label: 'Admin', icon: Shield },
]

const adminSidebarTabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'requests', label: 'Storage Requests', icon: HardDrive },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'tickets', label: 'Tickets', icon: MessageSquare },
  { id: 'appeals', label: 'Appeals', icon: Scale },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'deletions', label: 'Deletion Requests', icon: Trash2 },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList },
  { id: 'access-codes', label: 'Access Codes', icon: Key },
  { id: 'takedown', label: 'Takedown', icon: ShieldAlert },
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
  const [activeAdminTab, setActiveAdminTab] = useState('overview')

  // Track the active admin tab from URL hash
  useEffect(() => {
    if (isAdminRoute) {
      const hash = window.location.hash.replace('#', '')
      if (hash) setActiveAdminTab(hash)
    }
  }, [pathname])

  const isSupportRoute = pathname.startsWith('/dashboard/support')
  const isAdminRoute = pathname.startsWith('/dashboard/admin')

  const suspendedAllowedRoutes = ['/dashboard', '/dashboard/support', '/dashboard/settings']
  const visibleNavItems = suspended
    ? navItems.filter((item) => suspendedAllowedRoutes.includes(item.href))
    : navItems

  // On admin pages, hide user tabs — only show the admin nav
  const allNavItems = isAdminRoute
    ? adminNavItems
    : isAdmin
      ? [...visibleNavItems, ...adminNavItems]
      : visibleNavItems

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

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="h-14 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground -ml-1 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <div
                className="size-7 rounded-md flex items-center justify-center"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                <HardDrive className="size-3.5" style={{ color: 'var(--brand-foreground)' }} />
              </div>
              <span className="text-sm font-semibold tracking-tight">el4scloud</span>
            </Link>
          </div>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" size="sm" className="gap-2 px-2">
                <Avatar className="size-6">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm hidden sm:block max-w-32 truncate">{user.name}</span>
              </Button>
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

      <div className="flex flex-1">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:sticky top-14 z-50 h-[calc(100svh-3.5rem)] w-56 shrink-0 border-r border-border bg-background transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col gap-0.5 p-3">
            <div className="flex items-center justify-between mb-2 lg:hidden">
              <span className="text-xs font-semibold tracking-tight">Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="size-4" />
              </button>
            </div>
            {isAdminRoute ? (
              <>
                <div className="text-xs font-medium text-muted-foreground px-3 py-1.5 uppercase tracking-wider">
                  Admin
                </div>
                {adminSidebarTabs.map(({ id, label, icon: Icon }) => {
                  const active = activeAdminTab === id
                  return (
                    <a
                      key={id}
                      href={`/dashboard/admin#${id}`}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                        active
                          ? 'bg-secondary text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{label}</span>
                    </a>
                  )
                })}
              </>
            ) : (
              allNavItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                      active
                        ? 'bg-secondary text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                )
              })
            )}
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {suspended && !suspendedAllowedRoutes.includes(pathname) && !pathname.startsWith('/dashboard/admin') ? (
              <SuspensionBanner reason={suspensionReason ?? 'Account suspended'} appealable={appealable} suspensionType={suspensionType ?? undefined} />
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="h-12 flex items-center justify-center gap-6 px-4 sm:px-6 lg:px-8">
          {!suspended && <StorageRequestDialog />}
        </div>
      </footer>
    </div>
  )
}
