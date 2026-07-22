// API: POST /api/auth/login - prijava uporabnika
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Manjka uporabniško ime ali geslo' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { username } })
    if (!user || !user.active) {
      return NextResponse.json({ error: 'Napačno uporabniško ime ali geslo' }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.password)
    if (!ok) {
      return NextResponse.json({ error: 'Napačno uporabniško ime ali geslo' }, { status: 401 })
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    await createSession({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    })

    await logAudit({
      userId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      description: `Prijava uporabnika: ${user.username}`,
    })

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (e: any) {
    console.error('Login error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
