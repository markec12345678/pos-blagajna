// API: GET/POST /api/pos/orders - naročila (za kuhinjo)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// Generiraj unikatno številko naročila: N-YYYYMMDD-XXXX
async function generateOrderNo(): Promise<string> {
  const now = new Date()
  const ymd =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0')
  for (let attempt = 0; attempt < 10; attempt++) {
    const random = Math.floor(1000 + Math.random() * 9000).toString()
    const orderNo = `N-${ymd}-${random}`
    const existing = await db.order.findUnique({ where: { orderNo } })
    if (!existing) return orderNo
  }
  // Fallback z večjo naključnostjo
  const random = Math.floor(100000 + Math.random() * 900000).toString()
  return `N-${ymd}-${random}`
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        table: true,
        cashier: { select: { id: true, username: true, name: true } },
      },
    })
    return NextResponse.json({ orders })
  } catch (e: any) {
    console.error('GET /api/pos/orders error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { tableId, type, customerName, items, note } = body as {
      tableId?: string
      type: string
      customerName?: string
      items: Array<{ productId: string; quantity: number; note?: string }>
      note?: string
    }

    if (!type || !['dine_in', 'takeaway', 'delivery'].includes(type)) {
      return NextResponse.json({ error: 'Neveljaven tip naročila' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Manjkajo postavke naročila' }, { status: 400 })
    }

    // Pridobi izdelke za cene
    const productIds = items.map((i) => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    // Preveri da so vsi izdelki najdeni
    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return NextResponse.json({ error: `Izdelek ${item.productId} ne obstaja` }, { status: 400 })
      }
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: 'Količina mora biti pozitivna' }, { status: 400 })
      }
    }

    const orderNo = await generateOrderNo()

    // Pripravi postavke in izračunaj skupno
    const orderItems = items.map((item) => {
      const product = productMap.get(item.productId)!
      const total = product.price * item.quantity
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        unit: product.unit,
        total,
        note: item.note || null,
        status: 'pending',
      }
    })

    const total = orderItems.reduce((sum, i) => sum + i.total, 0)
    const itemsCount = orderItems.reduce((sum, i) => sum + i.quantity, 0)

    const order = await db.order.create({
      data: {
        orderNo,
        tableId: tableId || null,
        status: 'open',
        type,
        customerName: customerName || null,
        itemsCount,
        total,
        note: note || null,
        cashierId: auth.id,
        items: { create: orderItems },
      },
      include: {
        items: true,
        table: true,
        cashier: { select: { id: true, username: true, name: true } },
      },
    })

    // Posodobi status mize na occupied, če je povezana
    if (tableId) {
      await db.table.update({
        where: { id: tableId },
        data: { status: 'occupied' },
      })
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/pos/orders error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
