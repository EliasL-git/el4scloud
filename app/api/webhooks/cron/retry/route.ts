import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processRetryQueue } from '@/lib/webhooks/queue'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await processRetryQueue()
    return NextResponse.json({ processed: result.processed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
