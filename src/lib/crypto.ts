import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
// 32-byte key，從環境變數讀取，dev 用預設值
const SECRET = (process.env.ENCRYPTION_SECRET ?? 'paxis-dev-secret-key-32-bytes!!').slice(0, 32)

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, Buffer.from(SECRET), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGO, Buffer.from(SECRET), iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
