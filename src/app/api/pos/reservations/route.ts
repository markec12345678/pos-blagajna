// API: GET /api/pos/reservations - seznam rezervacij (z filtri)
// API: POST /api/pos/reservations - nova rezervacija
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') // YYYY-MM-DD (en dan)
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (status) where.status = status

    if (date) {
      // Dan od 00:00:00 do 23:59:59.999
      const start = new Date(`${date}T00:00:00.000Z`)
      const end = new Date(`${date}T23:59:59.999Z`)
      where.datetime = { gte: start, lte: end }
    } else if (from || to) {
      where.datetime = {}
      if (from) where.datetime.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.datetime.lte = toDate
      }
    }

    const reservations = await db.reservation.findMany({
      where,
      orderBy: { datetime: 'asc' },
      include: {
        table: true,
      },
    })

    return NextResponse.json({ reservations })
  } catch (e: any) {
    console.error('GET /api/pos/reservations error:', e)
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
    const {
      tableId,
      customerName,
      customerPhone,
      customerEmail,
      partySize,
      datetime,
      duration,
      note,
    } = body as {
      tableId?: string
      customerName?: string
      customerPhone?: string
      customerEmail?: string
      partySize?: number
      datetime?: string
      duration?: number
      note?: string
    }

    if (!customerName || String(customerName).trim() === '') {
      return NextResponse.json(
        { error: 'Ime stranke je obvezno' },
        { status: 400 }
      )
    }
    if (partySize === undefined || partySize === null || Number(partySize) < 1) {
      return NextResponse.json(
        { error: 'Število oseb mora biti vsaj 1' },
        { status: 400 }
      )
    }
    if (!datetime) {
      return NextResponse.json(
        { error: 'Datum in čas rezervacije sta obvezna' },
        { status: 400 }
      )
    }
    const dt = new Date(datetime)
    if (isNaN(dt.getTime())) {
      return NextResponse.json(
        { error: 'Neveljaven datum in čas' },
        { status: 400 }
      )
    }
    if (dt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Datum in čas rezervacije morata biti v prihodnosti' },
        { status: 400 }
      )
    }

    // Če je podan tableId, preveri da miza obstaja
    if (tableId) {
      const table = await db.table.findUnique({ where: { id: tableId } })
      if (!table) {
        return NextResponse.json(
          { error: 'Miza ne obstaja' },
          { status: 400 }
        )
      }
    }

    const reservation = await db.reservation.create({
      data: {
        tableId: tableId || null,
        customerName: String(customerName).trim(),
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        partySize: Number(partySize),
        datetime: dt,
        duration: duration !== undefined ? Number(duration) : 120,
        status: 'pending',
        note: note || null,
        createdBy: auth.id,
      },
      include: {
        table: true,
      },
    })

    return NextResponse.json({ reservation }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/pos/reservations error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
