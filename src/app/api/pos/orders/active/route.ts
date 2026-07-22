// API: GET /api/pos/orders/active - aktivna naročila (za kuhinjo in natakarje)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const orders = await db.order.findMany({
      where: {
        status: { in: ['open', 'sent', 'preparing', 'ready'] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        table: true,
        cashier: { select: { id: true, username: true, name: true } },
      },
    })
    return NextResponse.json({ orders })
  } catch (e: any) {
    console.error('GET /api/pos/orders/active error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
