// API: GET /api/pos/time/status - status ure za trenutnega uporabnika
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeek(d: Date): Date {
  // Ponedeljek kot prvi dan
  const day = d.getDay() // 0=nedelja, 1=ponedeljek
  const diff = day === 0 ? 6 : day - 1
  const x = new Date(d)
  x.setDate(d.getDate() - diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function GET(_req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = startOfWeek(now)

    // Trenutno odprt vnos (clock in brez clock out)
    const currentEntry = await db.timeEntry.findFirst({
      where: { userId: auth.id, clockOut: null },
      orderBy: { clockIn: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
    })

    // Vnosi za danes (vsi, ki se začnejo danes ali so še odprti z začetkom prej)
    const todayEntries = await db.timeEntry.findMany({
      where: {
        userId: auth.id,
        clockIn: { gte: todayStart, lte: now },
      },
    })

    const todayMinutes = todayEntries.reduce((sum, e) => {
      const end = e.clockOut || now
      const mins = Math.round((end.getTime() - e.clockIn.getTime()) / 60000)
      return sum + Math.max(0, mins)
    }, 0)

    // Vnosi za ta teden
    const weekEntries = await db.timeEntry.findMany({
      where: {
        userId: auth.id,
        clockIn: { gte: weekStart, lte: now },
      },
    })

    const weekMinutes = weekEntries.reduce((sum, e) => {
      const end = e.clockOut || now
      const mins = Math.round((end.getTime() - e.clockIn.getTime()) / 60000)
      return sum + Math.max(0, mins)
    }, 0)

    return NextResponse.json({
      clockedIn: !!currentEntry,
      currentEntry: currentEntry || null,
      todayMinutes,
      weekMinutes,
    })
  } catch (e: any) {
    console.error('GET /api/pos/time/status error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
