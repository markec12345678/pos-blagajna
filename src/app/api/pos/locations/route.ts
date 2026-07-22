// API: GET/POST /api/pos/locations - upravljanje lokacij (HubSync)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const locations = await db.location.findMany({
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { syncLogs: true } } },
    })
    return NextResponse.json({ locations })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    if (!body.name) {
      return NextResponse.json({ error: 'Manjka ime lokacije' }, { status: 400 })
    }
    // Preveri unikatnost imena
    const existing = await db.location.findUnique({ where: { name: body.name } })
    if (existing) {
      return NextResponse.json({ error: 'Lokacija s tem imenom že obstaja' }, { status: 400 })
    }
    if (body.code) {
      const existingCode = await db.location.findUnique({ where: { code: body.code } })
      if (existingCode) {
        return NextResponse.json({ error: 'Koda že obstaja' }, { status: 400 })
      }
    }
    // Če je isMain, odstrani isMain z drugih
    if (body.isMain) {
      await db.location.updateMany({ where: { isMain: true }, data: { isMain: false } })
    }
    const location = await db.location.create({
      data: {
        name: body.name,
        code: body.code || null,
        address: body.address || null,
        phone: body.phone || null,
        email: body.email || null,
        isMain: !!body.isMain,
        isHub: !!body.isHub,
        hubUrl: body.hubUrl || null,
        hubToken: body.hubToken || null,
      },
    })
    await logAudit({
      userId: auth.id,
      action: 'create',
      entityType: 'location',
      entityId: location.id,
      description: `Ustvarjena lokacija: ${location.name}`,
      metadata: { name: location.name, code: location.code, isMain: location.isMain, isHub: location.isHub },
    })
    return NextResponse.json({ location })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
