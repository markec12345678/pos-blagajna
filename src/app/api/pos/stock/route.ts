// API: GET /api/pos/stock - izdelki z nizko zalogo
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const products = await db.product.findMany({
      where: {
        active: true,
        stock: { lte: db.product.fields.minStock },
      },
      orderBy: { stock: 'asc' },
      include: { category: true },
    })
    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      minStock: p.minStock,
      unit: p.unit,
      category: p.category,
      deficit: p.minStock - p.stock,
    }))
    return NextResponse.json({ products: result, count: result.length })
  } catch (e: any) {
    console.error('GET /api/pos/stock error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
