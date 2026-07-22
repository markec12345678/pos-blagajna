// API: GET/PATCH/DELETE /api/pos/locations/[id]
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const location = await db.location.findUnique({
      where: { id },
      include: { syncLogs: { take: 10, orderBy: { createdAt: 'desc' } } },
    })
    if (!location) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }
    return NextResponse.json({ location })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.location.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }
    // Če spreminjamo isMain na true, odstrani z drugih
    if (body.isMain === true && !existing.isMain) {
      await db.location.updateMany({ where: { isMain: true, NOT: { id } }, data: { isMain: false } })
    }
    const allowed = ['name', 'code', 'address', 'phone', 'email', 'isMain', 'isHub', 'hubUrl', 'hubToken', 'active']
    const data: any = {}
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key]
    }
    const location = await db.location.update({ where: { id }, data })
    await logAudit({
      userId: auth.id,
      action: 'update',
      entityType: 'location',
      entityId: id,
      description: `Posodobljena lokacija: ${location.name}`,
      metadata: { changes: Object.keys(data) },
    })
    return NextResponse.json({ location })
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
    const existing = await db.location.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }
    if (existing.isMain) {
      return NextResponse.json({ error: 'Glavne lokacije ni mogoče izbrisati' }, { status: 400 })
    }
    await db.location.delete({ where: { id } })
    await logAudit({
      userId: auth.id,
      action: 'delete',
      entityType: 'location',
      entityId: id,
      description: `Izbrisana lokacija: ${existing.name}`,
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
