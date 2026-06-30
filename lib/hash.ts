import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

function serialize(key: string, salt: string, hash: string) {
  return `$scrypt$*${salt}*${hash}`
}

function deserialize(encoded: string) {
  const parts = encoded.split('*')
  return { salt: parts[1]!, hash: parts[2]! }
}

export async function hash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64) as Buffer
  return serialize(password, salt, derivedKey.toString('hex'))
}

export async function verify(password: string, encoded: string): Promise<boolean> {
  const { salt, hash: storedHash } = deserialize(encoded)
  const derivedKey = scryptSync(password, salt, 64) as Buffer
  const storedKey = Buffer.from(storedHash, 'hex')
  if (derivedKey.length !== storedKey.length) return false
  return timingSafeEqual(derivedKey, storedKey)
}
