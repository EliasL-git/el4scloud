import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, account } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { HC_STORAGE_LIMIT } from '@/lib/storage'
import { DashboardShell } from '@/components/dashboard/shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [u] = await db
    .select({
      role: user.role,
      banned: user.banned,
      suspensionReason: user.suspensionReason,
      suspensionType: user.suspensionType,
      terminatedAt: user.terminatedAt,
      appealable: user.appealable,
      agreedToTerms: user.agreedToTerms,
      storageLimit: user.storageLimit,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u) redirect('/sign-in')

  if (process.env.NO_EMAIL === 'true' && !u.emailVerified && !u.banned) {
    redirect('/introduction')
  }

  if (!u?.agreedToTerms) {
    await db
      .update(user)
      .set({ agreedToTerms: true })
      .where(eq(user.id, session.user.id))
  }

  // Auto-upgrade Hack Club members to HC storage limit
  const [hcAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, 'hackclub')
      )
    )

  if (hcAccount && (u.storageLimit ?? 0) < HC_STORAGE_LIMIT) {
    await db
      .update(user)
      .set({ storageLimit: HC_STORAGE_LIMIT })
      .where(eq(user.id, session.user.id))
  }

  const suspensionType = u?.suspensionType as 'suspended' | 'terminated' | null | undefined
  const isAdmin = u?.role === 'admin'
  // 'warned' users are banned but not suspended — they must see the dashboard page
  // (including the ViolationWarningDialog) so they can reactivate.
  const suspended = !!(u?.banned && u?.suspensionReason && u?.suspensionType !== 'warned')
  const appealable = u?.appealable

  return (
    <DashboardShell user={session.user} isAdmin={isAdmin} suspended={suspended} suspensionReason={u?.suspensionReason ?? undefined} appealable={appealable} suspensionType={suspensionType}>
      {children}
    </DashboardShell>
  )
}
