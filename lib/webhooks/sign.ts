import crypto from 'crypto'

export function signPayload(secret: string, payload: object): { signature: string; deliveryId: string } {
  const deliveryId = crypto.randomUUID()
  const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
  return { signature, deliveryId }
}
