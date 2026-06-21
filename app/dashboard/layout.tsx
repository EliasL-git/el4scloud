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
    .select({ role: user.role, banned: user.banned, agreedToTerms: user.agreedToTerms })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (u?.banned) {
    await auth.api.signOut({ headers: await headers() })
    redirect('/sign-in?banned=1')
  }

  if (!u?.agreedToTerms) {
    await db
      .update(user)
      .set({ agreedToTerms: true })
      .where(eq(user.id, session.user.id))
  }

  const isAdmin = u?.role === 'admin'

  return (
    <DashboardShell user={session.user} isAdmin={isAdmin}>
      {children}
    </DashboardShell>
  )
}
