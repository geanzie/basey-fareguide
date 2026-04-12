import crypto from 'crypto'

export function generateQrToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function fingerprintQrToken(token: string): string {
  return `sha256:${crypto.createHash('sha256').update(token).digest('hex').slice(0, 24)}`
}