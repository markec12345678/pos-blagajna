// API: GET /api/pos/sales/latest - zadnja prodaja (za prikaz racuna)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const sale = await db.sale.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { items: true, cashier: { select: { name: true } } },
    })
    if (!sale) {
      return NextResponse.json({ sale: null })
    }
    return NextResponse.json({ sale })
  } catch (e: any) {
    console.error('GET /api/pos/sales/latest error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
