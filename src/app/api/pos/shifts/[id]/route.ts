// API: PATCH/DELETE /api/pos/shifts/[id]
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.shift.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Urnik ni najden' }, { status: 404 })
    }

    const allowed = ['startTime', 'endTime', 'breakMinutes', 'role', 'status', 'note']
    const data: any = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'startTime' || key === 'endTime') {
          data[key] = body[key] ? new Date(body[key]) : null
        } else {
          data[key] = body[key]
        }
      }
    }

    const shift = await db.shift.update({ where: { id }, data, include: { user: { select: { name: true } } } })
    await logAudit({
      userId: auth.id,
      action: 'update',
      entityType: 'shift',
      entityId: id,
      description: `Urnik posodobljen za ${shift.user.name}`,
    })
    return NextResponse.json({ shift })
  } catch (e: any) {
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
    const existing = await db.shift.findUnique({ where: { id }, include: { user: { select: { name: true } } } })
    if (!existing) {
      return NextResponse.json({ error: 'Urnik ni najden' }, { status: 404 })
    }
    await db.shift.delete({ where: { id } })
    await logAudit({
      userId: auth.id,
      action: 'delete',
      entityType: 'shift',
      entityId: id,
      description: `Urnik izbrisan za ${existing.user.name}`,
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
