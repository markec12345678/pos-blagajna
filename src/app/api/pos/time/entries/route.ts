// API: GET /api/pos/time/entries - seznam časovnih vnosov
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}

    // Admin vidi vse, ostali samo svoje
    if (auth.role !== 'admin') {
      where.userId = auth.id
    } else if (userId) {
      where.userId = userId
    }

    if (from || to) {
      where.clockIn = {}
      if (from) where.clockIn.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.clockIn.lte = toDate
      }
    }

    const entries = await db.timeEntry.findMany({
      where,
      orderBy: { clockIn: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
    })

    return NextResponse.json({ entries })
  } catch (e: any) {
    console.error('GET /api/pos/time/entries error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
