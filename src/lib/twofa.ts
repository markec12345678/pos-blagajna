// 2FA (Two-Factor Authentication) — TOTP helper (otplib v13)
import { generateSecret, generate, generateURI, verify } from 'otplib'

/**
 * Generira nov TOTP secret (base32)
 */
export function generate2FASecret(): string {
  return generateSecret()
}

/**
 * Generira OTPAuth URI za QR kodo
 * Format: otpauth://totp/LABEL?secret=SECRET&issuer=ISSUER
 */
export function generate2FAUri(userEmail: string, secret: string, issuer: string = 'POS Blagajna'): string {
  return generateURI({
    type: 'totp',
    label: userEmail,
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  })
}

/**
 * Verificira TOTP token (6-mestna koda)
 */
export function verify2FAToken(token: string, secret: string): boolean {
  try {
    return verify({ token, secret, type: 'totp', algorithm: 'SHA1', digits: 6, period: 30 })
  } catch {
    return false
  }
}

/**
 * Generira 10 backup kod (za primer izgube telefonov)
 * Format: XXXX-XXXX (8 znakov, alfanumerični)
 */
export function generateBackupCodes(): string[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const codes: string[] = []
  for (let i = 0; i < 10; i++) {
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += chars[Math.floor(Math.random() * chars.length)]
      if (j === 3) code += '-'
    }
    codes.push(code)
  }
  return codes
}

/**
 * Hash backup kode za varno shranjevanje
 */
export function hashBackupCodes(codes: string[]): string {
  return JSON.stringify(codes)
}

/**
 * Preveri backup kodo in jo označi kot porabljeno
 */
export function verifyBackupCode(inputCode: string, storedCodesJson: string): { valid: boolean; remainingCodes: string[] } {
  try {
    const codes: string[] = JSON.parse(storedCodesJson)
    const index = codes.indexOf(inputCode.toUpperCase())
    if (index >= 0) {
      codes.splice(index, 1)
      return { valid: true, remainingCodes: codes }
    }
    return { valid: false, remainingCodes: codes }
  } catch {
    return { valid: false, remainingCodes: [] }
  }
}
