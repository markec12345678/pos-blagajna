// API: POST /api/pos/sales - zakljuci prodajo (kreira racun) - z auth
// API: GET /api/pos/sales - vrne zgodovino prodaje
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

function generateReceiptNo(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 9000) + 1000)
  return `R-${y}${m}${d}-${random}`
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    const where: any = {}
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { items: true, cashier: { select: { name: true } } },
      }),
      db.sale.count({ where }),
    ])

    return NextResponse.json({ sales, total })
  } catch (e: any) {
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
    const { items, paymentMethod, paidAmount, customerId, customerName, note, discount, tips, orderId, settings } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Košarica je prazna' }, { status: 400 })
    }

    const taxRate = settings?.taxRate ?? 0.22
    const subtotal = items.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0)
    const discountAmount = parseFloat(discount || '0')
    const tipsAmount = parseFloat(tips || '0')
    const taxableAmount = Math.max(0, subtotal - discountAmount)
    const taxAmount = taxableAmount * taxRate / (1 + taxRate)
    const total = taxableAmount + tipsAmount
    const paid = parseFloat(paidAmount || '0')
    const change = Math.max(0, paid - total)

    let receiptNo = generateReceiptNo()
    let attempts = 0
    while (attempts < 10) {
      const exists = await db.sale.findUnique({ where: { receiptNo } })
      if (!exists) break
      receiptNo = generateReceiptNo()
      attempts++
    }

    const sale = await db.sale.create({
      data: {
        receiptNo,
        subtotal,
        taxRate,
        taxAmount,
        discount: discountAmount,
        tips: tipsAmount,
        total,
        paymentMethod: paymentMethod || 'cash',
        paidAmount: paid,
        changeAmount: change,
        status: 'completed',
        customerId: customerId || null,
        customerName: customerName || null,
        cashierId: auth.id,
        note: note || null,
        orderId: orderId || null,
        items: {
          create: items.map((it: any) => ({
            productId: it.productId || null,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            unit: it.unit || 'kos',
            total: it.price * it.quantity,
          })),
        },
      },
      include: { items: true },
    })
    console.log('Sale created:', sale.id, 'with', sale.items.length, 'items')

    // Posodobi zalogo
    for (const it of items) {
      if (it.productId) {
        const product = await db.product.findUnique({ where: { id: it.productId } })
        if (product) {
          await db.product.update({
            where: { id: it.productId },
            data: { stock: Math.max(0, product.stock - it.quantity) },
          })
        }
      }
    }

    // Posodobi strankine tocke in obisk
    if (customerId) {
      await db.customer.update({
        where: { id: customerId },
        data: {
          totalSpent: { increment: total },
          visits: { increment: 1 },
          loyaltyPoints: { increment: Math.floor(total) },
        },
      })
    }

    // Ce pride iz naročila, oznaci kot placano
    if (orderId) {
      await db.order.update({
        where: { id: orderId },
        data: { status: 'paid', paidAt: new Date() },
      })
    }

    return NextResponse.json({ sale })
  } catch (e: any) {
    console.error('POST /api/pos/sales error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
