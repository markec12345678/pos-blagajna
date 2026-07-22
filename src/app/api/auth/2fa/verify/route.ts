// API: POST /api/auth/2fa/verify - potrdi 2FA s TOTP tokenom
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { verify2FAToken } from '@/lib/twofa'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { token } = await req.json()
    if (!token || token.length !== 6) {
      return NextResponse.json({ error: 'Manjka ali napačna koda (6 mest)' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: auth.id } })
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA ni bil nastavljen. Najprej zaženite setup.' }, { status: 400 })
    }

    const valid = verify2FAToken(token, user.twoFactorSecret)
    if (!valid) {
      return NextResponse.json({ error: 'Napačna koda' }, { status: 401 })
    }

    // Omogoči 2FA
    await db.user.update({
      where: { id: auth.id },
      data: { twoFactorEnabled: true },
    })

    await logAudit({
      userId: auth.id,
      action: 'update',
      entityType: 'user',
      entityId: auth.id,
      description: '2FA omogočen',
    })

    return NextResponse.json({ success: true, message: '2FA uspešno omogočen!' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
