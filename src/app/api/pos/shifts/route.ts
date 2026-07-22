// API: GET/POST /api/pos/shifts - urniki zaposlenih
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const userId = searchParams.get('userId')

    const where: any = {}
    if (userId) where.userId = userId
    if (from || to) {
      where.startTime = {}
      if (from) where.startTime.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.startTime.lte = toDate
      }
    }

    const shifts = await db.shift.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: { user: { select: { id: true, username: true, name: true, role: true } } },
    })
    return NextResponse.json({ shifts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { userId, startTime, endTime, breakMinutes, role, note } = body

    if (!userId || !startTime) {
      return NextResponse.json({ error: 'Manjka uporabnik ali začetni čas' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Uporabnik ni najden' }, { status: 404 })
    }

    const shift = await db.shift.create({
      data: {
        userId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        breakMinutes: breakMinutes || 30,
        role: role || user.role,
        note: note || null,
        createdBy: auth.id,
      },
      include: { user: { select: { id: true, username: true, name: true, role: true } } },
    })

    await logAudit({
      userId: auth.id,
      action: 'create',
      entityType: 'shift',
      entityId: shift.id,
      description: `Urnik ustvarjen za ${user.name}: ${new Date(startTime).toLocaleString('sl-SI')}`,
      metadata: { shiftUserId: userId, startTime },
    })

    return NextResponse.json({ shift })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
