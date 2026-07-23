// API: GET /api/pos/errors — zadnje napake iz audit loga
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const errors = await db.auditLog.findMany({
      where: { action: 'error' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { username: true, name: true } } },
    })

    const stats = {
      total: errors.length,
      last24h: errors.filter(e => Date.now() - new Date(e.createdAt).getTime() < 24 * 60 * 60 * 1000).length,
      last7d: errors.filter(e => Date.now() - new Date(e.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length,
    }

    return NextResponse.json({ errors, stats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
