// API: POST /api/auth/2fa/disable - onemogoči 2FA (zahteva token ali backup kodo)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { verify2FAToken, verifyBackupCode } from '@/lib/twofa'
import { hashBackupCodes } from '@/lib/twofa'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { token, backupCode } = await req.json()
    const user = await db.user.findUnique({ where: { id: auth.id } })
    if (!user || !user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA ni omogočen' }, { status: 400 })
    }

    let verified = false

    // Preveri TOTP token
    if (token && user.twoFactorSecret) {
      verified = verify2FAToken(token, user.twoFactorSecret)
    }

    // Preveri backup kodo
    if (!verified && backupCode && user.twoFactorBackupCodes) {
      const result = verifyBackupCode(backupCode, user.twoFactorBackupCodes)
      if (result.valid) {
        verified = true
        // Posodobi preostale backup kode
        await db.user.update({
          where: { id: auth.id },
          data: { twoFactorBackupCodes: hashBackupCodes(result.remainingCodes) },
        })
      }
    }

    if (!verified) {
      return NextResponse.json({ error: 'Napačna koda ali backup koda' }, { status: 401 })
    }

    // Onemogoči 2FA
    await db.user.update({
      where: { id: auth.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    })

    await logAudit({
      userId: auth.id,
      action: 'update',
      entityType: 'user',
      entityId: auth.id,
      description: '2FA onemogočen',
    })

    return NextResponse.json({ success: true, message: '2FA onemogočen' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
