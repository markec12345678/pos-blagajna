// API: POST /api/pos/sms/reservation - pošlji SMS potrditev rezervacije (admin only)
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sendReservationSms, isSmsConfigured } from '@/lib/sms'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { reservationId } = body
    if (!reservationId) {
      return NextResponse.json({ error: 'Manjka ID rezervacije' }, { status: 400 })
    }
    const reservation = await db.reservation.findUnique({ where: { id: reservationId } })
    if (!reservation) {
      return NextResponse.json({ error: 'Rezervacija ni najdena' }, { status: 404 })
    }
    if (!reservation.customerPhone) {
      return NextResponse.json({ error: 'Kupec nima telefonske številke' }, { status: 400 })
    }
    if (!isSmsConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'SMS ni konfiguriran. Nastavi Twilio env spremenljivke.',
      }, { status: 400 })
    }
    const settings = await db.settings.findUnique({ where: { id: 'default' } })
    const restaurantName = settings?.restaurantName || 'Restavracija'
    const result = await sendReservationSms(
      reservation.customerPhone,
      reservation.customerName,
      restaurantName,
      reservation.datetime,
      reservation.partySize
    )
    if (result.success) {
      return NextResponse.json({ success: true, message: result.message })
    } else {
      return NextResponse.json({ success: false, message: result.error }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
