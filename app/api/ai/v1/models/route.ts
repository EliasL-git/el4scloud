import { AI_MODELS } from '@/lib/ai'

export async function GET() {
  const data = AI_MODELS.map((m) => ({
    id: m.id,
    object: 'model',
    created: 1746211200,
    owned_by: m.provider,
  }))

  return Response.json({ object: 'list', data })
}
