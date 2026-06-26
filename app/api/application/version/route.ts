export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    version: '0.1',
    build: 1,
  })
}
