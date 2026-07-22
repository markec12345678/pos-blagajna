// API: GET/POST /api/pos/tables - mize v restavraciji
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const tables = await db.table.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        orders: {
          where: { status: { in: ['open', 'sent', 'preparing', 'ready'] } },
          select: { id: true },
        },
      },
    })
    const result = tables.map((t) => ({
      id: t.id,
      name: t.name,
      seats: t.seats,
      area: t.area,
      status: t.status,
      active: t.active,
      activeOrdersCount: t.orders.length,
    }))
    return NextResponse.json({ tables: result })
  } catch (e: any) {
    console.error('GET /api/pos/tables error:', e)
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
    const { name, seats, area } = body
    if (!name) {
      return NextResponse.json({ error: 'Ime mize je obvezno' }, { status: 400 })
    }
    const existing = await db.table.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: 'Miza s tem imenom že obstaja' }, { status: 400 })
    }
    const table = await db.table.create({
      data: {
        name,
        seats: seats ? Number(seats) : 4,
        area: area || null,
      },
    })
    return NextResponse.json({ table })
  } catch (e: any) {
    console.error('POST /api/pos/tables error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
