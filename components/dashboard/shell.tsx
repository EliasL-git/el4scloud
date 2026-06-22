'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Files, Key, LogOut, HardDrive, Shield, MessageSquare, Settings, ShieldAlert } from 'lucide-react'
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

  const isSupportRoute = pathname.startsWith('/dashboard/support')

  const visibleNavItems = suspended
    ? navItems.filter((item) => item.href === '/dashboard/support')
    : navItems

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

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <div
                className="size-7 rounded-md flex items-center justify-center"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                <HardDrive className="size-3.5" style={{ color: 'var(--brand-foreground)' }} />
              </div>
              <span className="text-sm font-semibold tracking-tight hidden sm:block">el4scloud</span>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                const active = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                      active
                        ? 'bg-secondary text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
              {isAdmin && !suspended && adminNavItems.map((item) => {
                const Icon = item.icon
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                      active
                        ? 'bg-secondary text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
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

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {suspended && !isSupportRoute ? (
          <SuspensionBanner reason={suspensionReason ?? 'Account suspended'} appealable={appealable} suspensionType={suspensionType ?? undefined} />
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-center gap-6">
          {!suspended && (
            <>
              <StorageRequestDialog />
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
