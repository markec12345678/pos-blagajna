// API: POST /api/public/reserve - javna rezervacija (brez auth)
// Stranka lahko ustvari rezervacijo preko spletne strani
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerName, customerPhone, customerEmail, partySize, datetime, duration, note } = body

    // Validacija
    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: 'Manjka ime' }, { status: 400 })
    }
    if (!datetime) {
      return NextResponse.json({ error: 'Manjka datum in čas' }, { status: 400 })
    }
    const dt = new Date(datetime)
    if (isNaN(dt.getTime())) {
      return NextResponse.json({ error: 'Napačen format datuma' }, { status: 400 })
    }
    if (dt < new Date()) {
      return NextResponse.json({ error: 'Datum mora biti v prihodnosti' }, { status: 400 })
    }
    const ps = parseInt(partySize) || 2
    if (ps < 1 || ps > 50) {
      return NextResponse.json({ error: 'Število gostov mora biti med 1 in 50' }, { status: 400 })
    }

    // Ustvari rezervacijo (status: pending — čaka na potrditev)
    const reservation = await db.reservation.create({
      data: {
        customerName: customerName.trim(),
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        partySize: ps,
        datetime: dt,
        duration: parseInt(duration) || 120,
        note: note || null,
        status: 'pending',
      },
    })

    return NextResponse.json({
      success: true,
      reservation: {
        id: reservation.id,
        customerName: reservation.customerName,
        partySize: reservation.partySize,
        datetime: reservation.datetime,
        status: reservation.status,
      },
      message: 'Rezervacija sprejeta. Potrdili jo bomo v najkrajšem možnem času.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
