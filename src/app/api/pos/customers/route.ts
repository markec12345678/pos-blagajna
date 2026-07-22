// API: GET/POST /api/pos/customers - kupci
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim()

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const customers = await db.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ customers })
  } catch (e: any) {
    console.error('GET /api/pos/customers error:', e)
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
    const { name, email, phone, address, notes } = body as {
      name: string
      email?: string
      phone?: string
      address?: string
      notes?: string
    }

    if (!name) {
      return NextResponse.json({ error: 'Ime kupca je obvezno' }, { status: 400 })
    }

    // Preveri duplikate emaila/telefona (ce sta podana)
    if (email) {
      const existing = await db.customer.findFirst({ where: { email } })
      if (existing) {
        return NextResponse.json(
          { error: 'Kupec s tem emailom že obstaja' },
          { status: 400 }
        )
      }
    }

    const customer = await db.customer.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
      },
    })
    return NextResponse.json({ customer }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/pos/customers error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
