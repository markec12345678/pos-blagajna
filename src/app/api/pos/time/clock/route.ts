// API: POST /api/pos/time/clock - clock in / clock out
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { action, note } = body as { action: 'in' | 'out'; note?: string }

    if (action !== 'in' && action !== 'out') {
      return NextResponse.json(
        { error: "Akcija mora biti 'in' ali 'out'" },
        { status: 400 }
      )
    }

    const now = new Date()

    if (action === 'in') {
      // Preveri, če ima uporabnik že odprt TimeEntry (brez clockOut)
      const openEntry = await db.timeEntry.findFirst({
        where: { userId: auth.id, clockOut: null },
        orderBy: { clockIn: 'desc' },
      })
      if (openEntry) {
        return NextResponse.json(
          {
            error: 'Uporabnik je že prijavljen na delo (clock in že obstaja)',
            entry: openEntry,
          },
          { status: 400 }
        )
      }

      const entry = await db.timeEntry.create({
        data: {
          userId: auth.id,
          clockIn: now,
          note: note || null,
        },
      })

      return NextResponse.json({ entry }, { status: 201 })
    }

    // action === 'out'
    const openEntry = await db.timeEntry.findFirst({
      where: { userId: auth.id, clockOut: null },
      orderBy: { clockIn: 'desc' },
    })
    if (!openEntry) {
      return NextResponse.json(
        { error: 'Uporabnik ni prijavljen na delo (ni odprtega vnosa)' },
        { status: 400 }
      )
    }

    const diffMs = now.getTime() - openEntry.clockIn.getTime()
    const totalMinutes = Math.max(0, Math.round(diffMs / 60000))

    const updated = await db.timeEntry.update({
      where: { id: openEntry.id },
      data: {
        clockOut: now,
        totalMinutes,
        note: note || openEntry.note,
      },
    })

    return NextResponse.json({ entry: updated })
  } catch (e: any) {
    console.error('POST /api/pos/time/clock error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
