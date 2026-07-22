// API: GET/POST /api/pos/products/[id]/modifiers - produktni dodatki/modifikatorji
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const modifiers = await db.productModifier.findMany({
      where: { productId: id, active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ modifiers })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const body = await req.json()

    if (Array.isArray(body)) {
      // Bulk create — zamenjaj vse modifikatorje za ta izdelek
      await db.productModifier.deleteMany({ where: { productId: id } })
      const modifiers = await Promise.all(
        body.map(m => db.productModifier.create({
          data: {
            productId: id,
            name: m.name,
            priceDelta: parseFloat(m.priceDelta) || 0,
            type: m.type || 'addon',
            active: m.active !== false,
          },
        }))
      )
      return NextResponse.json({ modifiers })
    }

    // Single create
    const modifier = await db.productModifier.create({
      data: {
        productId: id,
        name: body.name,
        priceDelta: parseFloat(body.priceDelta) || 0,
        type: body.type || 'addon',
        active: body.active !== false,
      },
    })
    return NextResponse.json({ modifier })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
