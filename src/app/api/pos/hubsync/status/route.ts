// API: GET /api/pos/hubsync/status - status sinhronizacije
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const location = await db.location.findFirst({
      where: { isHub: false, active: true, hubUrl: { not: null } },
    })
    const syncLogs = await db.syncLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { location: { select: { name: true } } },
    })
    const pendingCount = await db.syncLog.count({ where: { status: 'pending' } })

    return NextResponse.json({
      location,
      lastSyncAt: location?.lastSyncAt || null,
      syncLogs,
      pendingCount,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
