// API: GET /api/pos/audit - seznam audit logov (admin only)
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
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const entityType = searchParams.get('entityType')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (userId) where.userId = userId
    if (action && action !== 'all') where.action = action
    if (entityType && entityType !== 'all') where.entityType = entityType
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = toDate
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { id: true, username: true, name: true, role: true } } },
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
