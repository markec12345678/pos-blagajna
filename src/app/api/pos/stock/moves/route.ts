// API: GET/POST /api/pos/stock/moves - premiki zaloge (sprejem, odpis, popravki)
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
    const productId = searchParams.get('productId')

    const where: any = {}
    if (productId) where.productId = productId

    const moves = await db.stockMove.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, unit: true, sku: true } },
        user: { select: { id: true, username: true, name: true } },
      },
    })
    return NextResponse.json({ moves })
  } catch (e: any) {
    console.error('GET /api/pos/stock/moves error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { productId, type, quantity, reason, unitCost, supplier } = body as {
      productId: string
      type: 'receiving' | 'waste' | 'adjustment'
      quantity: number
      reason?: string
      unitCost?: number
      supplier?: string
    }

    if (!productId || !type || quantity === undefined) {
      return NextResponse.json(
        { error: 'Manjkajo obvezna polja (productId, type, quantity)' },
        { status: 400 }
      )
    }
    if (!['receiving', 'waste', 'adjustment'].includes(type)) {
      return NextResponse.json({ error: 'Neveljaven tip premika' }, { status: 400 })
    }

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'Izdelek ni najden' }, { status: 404 })
    }

    let stockDelta = 0
    let effectiveQuantity = Number(quantity)

    if (type === 'receiving') {
      if (effectiveQuantity <= 0) {
        return NextResponse.json(
          { error: 'Količina za sprejem mora biti pozitivna' },
          { status: 400 }
        )
      }
      stockDelta = effectiveQuantity
    } else if (type === 'waste') {
      if (effectiveQuantity <= 0) {
        return NextResponse.json(
          { error: 'Količina za odpis mora biti pozitivna' },
          { status: 400 }
        )
      }
      stockDelta = -effectiveQuantity
    } else if (type === 'adjustment') {
      // adjustment: količina je lahko pozitivna ali negativna (direktna sprememba zaloge)
      stockDelta = effectiveQuantity
      effectiveQuantity = Math.abs(effectiveQuantity)
    }

    const totalValue =
      unitCost !== undefined && unitCost !== null
        ? effectiveQuantity * Number(unitCost)
        : null

    // Transakcijsko: zapiši premik in posodobi zalogo
    const [move] = await db.$transaction([
      db.stockMove.create({
        data: {
          productId,
          type,
          quantity: effectiveQuantity,
          reason: reason || null,
          unitCost: unitCost !== undefined ? Number(unitCost) : null,
          totalValue,
          userId: auth.id,
          supplier: supplier || null,
        },
        include: {
          product: { select: { id: true, name: true, unit: true } },
          user: { select: { id: true, username: true, name: true } },
        },
      }),
      db.product.update({
        where: { id: productId },
        data: { stock: { increment: stockDelta } },
      }),
    ])

    return NextResponse.json({ move }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/pos/stock/moves error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
