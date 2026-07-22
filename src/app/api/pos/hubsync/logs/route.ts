// API: GET /api/pos/hubsync/logs - seznam sinhronizacijskih logov
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const [logs, total] = await Promise.all([
      db.syncLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { location: { select: { id: true, name: true, code: true } } },
      }),
      db.syncLog.count({ where }),
    ])

    return NextResponse.json({ logs, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
