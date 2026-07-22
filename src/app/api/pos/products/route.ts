// API: GET /api/pos/products - vrne vse aktivne izdelke s kategorijami
// API: POST /api/pos/products - kreira nov izdelek (admin only)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const barcode = searchParams.get('barcode')
    const includeInactive = searchParams.get('all') === 'true'

    // Hitro iskanje po barkodi — vrne en izdelek
    if (barcode) {
      const product = await db.product.findFirst({
        where: { OR: [{ barcode }, { sku: barcode }] },
        include: { category: true },
      })
      return NextResponse.json({ product, products: product ? [product] : [] })
    }

    const where: any = includeInactive ? {} : { active: true }
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }

    const products = await db.product.findMany({
      where,
      include: { category: true },
      orderBy: [{ name: 'asc' }],
    })

    return NextResponse.json({ products })
  } catch (e: any) {
    console.error('GET /api/pos/products error:', e)
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
    const product = await db.product.create({
      data: {
        name: body.name,
        description: body.description || null,
        price: parseFloat(body.price),
        sku: body.sku || null,
        barcode: body.barcode || null,
        stock: parseFloat(body.stock || '0'),
        minStock: parseFloat(body.minStock || '5'),
        unit: body.unit || 'kos',
        categoryId: body.categoryId || null,
        isFood: body.isFood !== undefined ? !!body.isFood : true,
      },
      include: { category: true },
    })
    return NextResponse.json({ product })
  } catch (e: any) {
    console.error('POST /api/pos/products error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
