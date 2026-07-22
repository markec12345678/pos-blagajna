// API: GET /api/pos/customers/[id]/qr - generira QR kodo za kupca
// QR koda vsebuje customer ID za loyalty točke
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import QRCode from 'qrcode'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json({ error: 'Kupec ni najden' }, { status: 404 })
    }

    // Generiraj QR kodo z customer ID
    // Format: POS:CUSTOMER:{id} — lahko se razširi z digitalnim podpisom
    const qrData = `POS:CUSTOMER:${customer.id}`
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#059669', // emerald-600
        light: '#ffffff',
      },
    })

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        loyaltyPoints: customer.loyaltyPoints,
      },
      qrData,
      qrImage, // base64 data URL
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
