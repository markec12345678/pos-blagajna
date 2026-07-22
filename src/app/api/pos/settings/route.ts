// API: GET/PATCH /api/pos/settings - nastavitve aplikacije
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    let settings = await db.settings.findUnique({ where: { id: 'default' } })
    if (!settings) {
      settings = await db.settings.create({ data: { id: 'default' } })
    }
    return NextResponse.json({ settings })
  } catch (e: any) {
    console.error('GET /api/pos/settings error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    // Dovoljena polja za posodobitev
    const allowed = [
      'restaurantName',
      'address',
      'phone',
      'email',
      'vatNumber',
      'currency',
      'currencySymbol',
      'taxRate',
      'receiptFooter',
      'receiptHeader',
      'lowStockAlert',
      'printKitchenReceipt',
      'printClientReceipt',
      'defaultCashier',
    ]

    const data: any = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'taxRate') {
          data[key] = Number(body[key])
        } else {
          data[key] = body[key]
        }
      }
    }

    let settings = await db.settings.findUnique({ where: { id: 'default' } })
    if (!settings) {
      settings = await db.settings.create({ data: { id: 'default', ...data } })
    } else {
      settings = await db.settings.update({
        where: { id: 'default' },
        data,
      })
    }
    return NextResponse.json({ settings })
  } catch (e: any) {
    console.error('PATCH /api/pos/settings error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
