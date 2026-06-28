import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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
    })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u) redirect('/sign-in')

  if (!u?.agreedToTerms) {
    await db
      .update(user)
      .set({ agreedToTerms: true })
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
