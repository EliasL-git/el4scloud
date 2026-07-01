'use client'

import Link from 'next/link'
import { ShieldAlert, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function SuspensionBanner({ reason, suspensionType }: { reason: string; appealable?: boolean; suspensionType?: 'suspended' | 'terminated' }) {

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="size-5 text-destructive" />
            </div>
            <div>
              <CardTitle>{suspensionType === 'terminated' ? 'Account Terminated' : 'Account Suspended'}</CardTitle>
              <CardDescription>
                {suspensionType === 'terminated'
                  ? 'Your account has been terminated. Your data will be permanently deleted within 30 days.'
                  : 'Your account has been temporarily suspended'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Reason:</p>
            <p>{reason}</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="size-3.5 text-muted-foreground" />
            <Link href="/dashboard/support" className="text-[var(--brand)] hover:underline">
              Contact support
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
