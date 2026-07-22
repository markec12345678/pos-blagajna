// API: POST /api/auth/2fa/setup - začni 2FA nastavitev (generira secret in QR URI)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { generate2FASecret, generate2FAUri, generateBackupCodes, hashBackupCodes } from '@/lib/twofa'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const user = await db.user.findUnique({ where: { id: auth.id } })
    if (!user) {
      return NextResponse.json({ error: 'Uporabnik ni najden' }, { status: 404 })
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA je že omogočen. Najprej onemogočite.' }, { status: 400 })
    }

    // Generiraj nov secret (začasno — dokler ni potrjen z tokenom)
    const secret = generate2FASecret()
    const backupCodes = generateBackupCodes()

    // Shrani secret (še ne označi kot enabled)
    await db.user.update({
      where: { id: auth.id },
      data: {
        twoFactorSecret: secret,
        twoFactorBackupCodes: hashBackupCodes(backupCodes),
      },
    })

    const otpauthUri = generate2FAUri(user.email || user.username, secret)

    await logAudit({
      userId: auth.id,
      action: 'update',
      entityType: 'user',
      entityId: auth.id,
      description: '2FA nastavitev začeta',
    })

    return NextResponse.json({
      secret,
      otpauthUri,
      backupCodes, // prikaži samo enkrat — uporabnik mora shraniti
      message: 'Skeniraj QR kodo z aplikacijo (Google Authenticator, Authy) in potrdi s 6-mestno kodo.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
