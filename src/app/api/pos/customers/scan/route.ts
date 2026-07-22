// API: POST /api/pos/customers/scan - skeniraj QR kodo kupca
// Telo: { qrData: string } — format: POS:CUSTOMER:{id}
// Vrne kupca z loyalty točkami
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { qrData } = body
    if (!qrData) {
      return NextResponse.json({ error: 'Manjka QR podatki' }, { status: 400 })
    }

    // Parse QR data: POS:CUSTOMER:{id}
    const parts = qrData.split(':')
    if (parts.length < 3 || parts[0] !== 'POS' || parts[1] !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Napačen format QR kode' }, { status: 400 })
    }
    const customerId = parts.slice(2).join(':')

    const customer = await db.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      return NextResponse.json({ error: 'Kupec ni najden' }, { status: 404 })
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        totalSpent: customer.totalSpent,
        visits: customer.visits,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
