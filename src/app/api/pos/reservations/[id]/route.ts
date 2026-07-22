// API: GET/PATCH/DELETE /api/pos/reservations/[id]
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']

// Dovoljeni prehodi statusov
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin', 'cashier', 'chef'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const reservation = await db.reservation.findUnique({
      where: { id },
      include: { table: true },
    })
    if (!reservation) {
      return NextResponse.json(
        { error: 'Rezervacija ni najdena' },
        { status: 404 }
      )
    }
    return NextResponse.json({ reservation })
  } catch (e: any) {
    console.error('GET /api/pos/reservations/[id] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const { status, partySize, datetime, note, tableId } = body as {
      status?: string
      partySize?: number
      datetime?: string
      note?: string
      tableId?: string | null
    }

    const existing = await db.reservation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Rezervacija ni najdena' },
        { status: 404 }
      )
    }

    // Validacija prehodov statusa
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Neveljaven status. Dovoljeni: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      if (status !== existing.status) {
        const allowed = STATUS_TRANSITIONS[existing.status] || []
        if (!allowed.includes(status)) {
          return NextResponse.json(
            {
              error: `Prehod iz "${existing.status}" v "${status}" ni dovoljen. Dovoljeni naslednji statusi: ${allowed.length ? allowed.join(', ') : 'brez (končno stanje)'}`,
            },
            { status: 400 }
          )
        }
      }
    }

    if (partySize !== undefined && Number(partySize) < 1) {
      return NextResponse.json(
        { error: 'Število oseb mora biti vsaj 1' },
        { status: 400 }
      )
    }

    if (datetime !== undefined) {
      const dt = new Date(datetime)
      if (isNaN(dt.getTime())) {
        return NextResponse.json(
          { error: 'Neveljaven datum in čas' },
          { status: 400 }
        )
      }
      // Dovoli pretekli datum samo, če označujemo kot completed/no_show
      const newStatus = status !== undefined ? status : existing.status
      if (dt.getTime() <= Date.now() && !['completed', 'no_show', 'cancelled'].includes(newStatus)) {
        return NextResponse.json(
          { error: 'Datum in čas rezervacije morata biti v prihodnosti' },
          { status: 400 }
        )
      }
    }

    if (tableId !== undefined && tableId !== null) {
      const table = await db.table.findUnique({ where: { id: tableId } })
      if (!table) {
        return NextResponse.json(
          { error: 'Miza ne obstaja' },
          { status: 400 }
        )
      }
    }

    const data: any = {}
    if (status !== undefined) data.status = status
    if (partySize !== undefined) data.partySize = Number(partySize)
    if (datetime !== undefined) data.datetime = new Date(datetime)
    if (note !== undefined) data.note = note
    if (tableId !== undefined) data.tableId = tableId || null

    const updated = await db.reservation.update({
      where: { id },
      data,
      include: { table: true },
    })

    return NextResponse.json({ reservation: updated })
  } catch (e: any) {
    console.error('PATCH /api/pos/reservations/[id] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const existing = await db.reservation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Rezervacija ni najdena' },
        { status: 404 }
      )
    }
    await db.reservation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/pos/reservations/[id] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
