// API: GET/PATCH /api/pos/orders/[id] - posamezno naročilo
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true, image: true, isFood: true } } } },
        table: true,
        cashier: { select: { id: true, username: true, name: true } },
      },
    })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }
    return NextResponse.json({ order })
  } catch (e: any) {
    console.error('GET /api/pos/orders/[id] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const { action, items } = body as {
      action: 'send' | 'start_preparing' | 'ready' | 'serve' | 'cancel' | 'add_items'
      items?: Array<{ productId: string; quantity: number; note?: string }>
    }

    const order = await db.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }
    if (order.status === 'cancelled' || order.status === 'paid') {
      return NextResponse.json(
        { error: 'Naročilo je že zaključeno' },
        { status: 400 }
      )
    }

    // Chef lahko samo začne pripravo ali označi pripravljeno
    if (auth.role === 'chef' && action !== 'start_preparing' && action !== 'ready') {
      return NextResponse.json(
        { error: 'Kuhar lahko samo začne pripravo ali označi pripravljeno' },
        { status: 403 }
      )
    }

    const now = new Date()

    if (action === 'send') {
      await db.order.update({
        where: { id },
        data: { status: 'sent', sentAt: now },
      })
    } else if (action === 'start_preparing') {
      await db.order.update({
        where: { id },
        data: { status: 'preparing' },
      })
      await db.orderItem.updateMany({
        where: { orderId: id, status: 'pending' },
        data: { status: 'preparing' },
      })
    } else if (action === 'ready') {
      await db.order.update({
        where: { id },
        data: { status: 'ready', readyAt: now },
      })
      await db.orderItem.updateMany({
        where: { orderId: id, status: { in: ['pending', 'preparing'] } },
        data: { status: 'ready' },
      })
    } else if (action === 'serve') {
      await db.order.update({
        where: { id },
        data: { status: 'served', servedAt: now },
      })
      await db.orderItem.updateMany({
        where: { orderId: id, status: 'ready' },
        data: { status: 'served' },
      })
    } else if (action === 'cancel') {
      await db.order.update({
        where: { id },
        data: { status: 'cancelled' },
      })
      // Sprosti mizo
      if (order.tableId) {
        await db.table.update({
          where: { id: order.tableId },
          data: { status: 'free' },
        })
      }
    } else if (action === 'add_items') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'Manjkajo postavke za dodajanje' },
          { status: 400 }
        )
      }
      const productIds = items.map((i) => i.productId)
      const products = await db.product.findMany({
        where: { id: { in: productIds } },
      })
      const productMap = new Map(products.map((p) => [p.id, p]))
      for (const item of items) {
        if (!productMap.has(item.productId)) {
          return NextResponse.json(
            { error: `Izdelek ${item.productId} ne obstaja` },
            { status: 400 }
          )
        }
      }
      const newItems = items.map((item) => {
        const product = productMap.get(item.productId)!
        const total = product.price * item.quantity
        return {
          orderId: id,
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
      await db.orderItem.createMany({ data: newItems })

      // Znova izračunaj skupno in število
      const allItems = await db.orderItem.findMany({ where: { orderId: id } })
      const total = allItems.reduce((sum, i) => sum + i.total, 0)
      const itemsCount = allItems.reduce((sum, i) => sum + i.quantity, 0)
      await db.order.update({
        where: { id },
        data: { total, itemsCount },
      })
    } else {
      return NextResponse.json({ error: 'Neveljaven ukaz' }, { status: 400 })
    }

    const updated = await db.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        table: true,
        cashier: { select: { id: true, username: true, name: true } },
      },
    })
    return NextResponse.json({ order: updated })
  } catch (e: any) {
    console.error('PATCH /api/pos/orders/[id] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
