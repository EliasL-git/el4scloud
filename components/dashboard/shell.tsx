'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Key, LogOut, HardDrive, Shield, MessageSquare, Settings, Menu, X as XIcon, LayoutDashboard, FileText, Scale, ShieldAlert, Trash2, ClipboardList, Users, Webhook, ShieldCheck, Ban, Megaphone, Fingerprint, ChevronRight } from 'lucide-react'
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

const serviceNavItems = [
  { href: '/dashboard/storage', label: 'Storage', icon: HardDrive },
]

const accountNavItems = [
  { href: '/dashboard/keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dashboard/support', label: 'Support', icon: MessageSquare },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const adminNavItems = [
  { href: '/dashboard/admin', label: 'Admin', icon: Shield },
]

const adminSidebarTabs = [
  { id: 'overview', label: 'Overview', href: '/dashboard/admin/overview', icon: LayoutDashboard },
  { id: 'requests', label: 'Storage Requests', href: '/dashboard/admin/requests', icon: HardDrive },
  { id: 'users', label: 'Users', href: '/dashboard/admin/users', icon: Users },
  { id: 'tickets', label: 'Tickets', href: '/dashboard/admin/tickets', icon: MessageSquare },
  { id: 'appeals', label: 'Appeals', href: '/dashboard/admin/appeals', icon: Scale },
  { id: 'files', label: 'Files', href: '/dashboard/admin/files', icon: FileText },
  { id: 'deletions', label: 'Deletion Requests', href: '/dashboard/admin/deletions', icon: Trash2 },
  { id: 'audit', label: 'Audit Log', href: '/dashboard/admin/audit', icon: ClipboardList },
  { id: 'verifications', label: 'Verifications', href: '/dashboard/admin/verifications', icon: ShieldCheck },
  { id: 'fraud', label: 'Fraud Detection', href: '/dashboard/admin/fraud', icon: Fingerprint },
  { id: 'broadcasts', label: 'Broadcasts', href: '/dashboard/admin/broadcasts', icon: Megaphone },
  { id: 'domains', label: 'Banned Domains', href: '/dashboard/admin/domains', icon: Ban },
  { id: 'takedown', label: 'Takedown', href: '/dashboard/admin/takedown', icon: ShieldAlert },
]

interface User {
  id: string
  name: string
  email: string
  image?: string | null
}

function NavLink({ href, icon: Icon, label, active, onClick }: { href: string; icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
      )}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />}
      <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground transition-colors')} />
      <span>{label}</span>
    </Link>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">{label}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
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
  const visibleServiceItems = suspended
    ? serviceNavItems.filter((item) => suspendedAllowedRoutes.includes(item.href))
    : serviceNavItems
  const visibleAccountItems = suspended
    ? accountNavItems.filter((item) => suspendedAllowedRoutes.includes(item.href))
    : accountNavItems

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

  const isAdminRoute = pathname.startsWith('/dashboard/admin')

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <div className="flex flex-1">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={closeSidebar} />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:sticky top-0 z-50 h-svh w-60 shrink-0 border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border">
              <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0" onClick={closeSidebar}>
                <div className="size-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                  <HardDrive className="size-4 text-primary-foreground" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Hobbycloud</span>
                  <p className="text-[10px] text-muted-foreground/60 leading-none">Dashboard</p>
                </div>
              </Link>
              <button onClick={closeSidebar} className="text-muted-foreground hover:text-foreground lg:hidden">
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <NavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === '/dashboard'} onClick={closeSidebar} />

              {isAdminRoute ? (
                <NavSection label="Admin">
                  {adminSidebarTabs.map(({ id, label, href, icon: Icon }) => (
                    <NavLink key={id} href={href} icon={Icon} label={label} active={pathname === href} onClick={closeSidebar} />
                  ))}
                </NavSection>
              ) : (
                <>
                  {visibleServiceItems.length > 0 && (
                    <NavSection label="Services">
                      {visibleServiceItems.map(({ href, label, icon: Icon }) => (
                        <NavLink key={href} href={href} icon={Icon} label={label} active={isActive(href)} onClick={closeSidebar} />
                      ))}
                    </NavSection>
                  )}
                  <NavSection label="Account">
                    {visibleAccountItems.map(({ href, label, icon: Icon }) => (
                      <NavLink key={href} href={href} icon={Icon} label={label} active={isActive(href)} onClick={closeSidebar} />
                    ))}
                  </NavSection>
                  {isAdmin && (
                    <NavSection label="Admin">
                      {adminNavItems.map(({ href, label, icon: Icon }) => (
                        <NavLink key={href} href={href} icon={Icon} label={label} active={isActive(href)} onClick={closeSidebar} />
                      ))}
                    </NavSection>
                  )}
                </>
              )}
            </div>

            {/* User section */}
            <div className="border-t border-sidebar-border p-3">
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="sm" className="w-full gap-2.5 px-2.5 justify-start h-10 rounded-lg hover:bg-sidebar-accent">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate text-sidebar-foreground">{user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  </Button>
                } />
                <DropdownMenuContent align="start" className="w-56">
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
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 relative bg-background">
          <button
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "fixed top-3.5 left-3.5 z-30 lg:hidden size-8 rounded-lg flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            )}
          >
            <Menu className="size-4" />
          </button>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {suspended && !suspendedAllowedRoutes.includes(pathname) && !isAdminRoute ? (
              <SuspensionBanner reason={suspensionReason ?? 'Account suspended'} appealable={appealable} suspensionType={suspensionType ?? undefined} />
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      <BroadcastPopup />

    </div>
  )
}
