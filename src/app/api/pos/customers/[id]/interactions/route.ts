// API: GET/POST /api/pos/customers/[id]/interactions - CRM interakcije
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const interactions = await db.customerInteraction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ interactions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const body = await req.json()
    if (!body.type || !body.subject) {
      return NextResponse.json({ error: 'Manjka tip ali zadeva' }, { status: 400 })
    }
    const validTypes = ['call', 'email', 'visit', 'note', 'complaint', 'feedback']
    if (!validTypes.includes(body.type)) {
      return NextResponse.json({ error: 'Napačen tip interakcije' }, { status: 400 })
    }
    const interaction = await db.customerInteraction.create({
      data: {
        customerId: id,
        type: body.type,
        subject: body.subject,
        description: body.description || null,
        userId: auth.id,
      },
    })
    await logAudit({
      userId: auth.id,
      action: 'create',
      entityType: 'customer_interaction',
      entityId: interaction.id,
      description: `CRM interakcija z kupcem: ${body.type} — ${body.subject}`,
      metadata: { customerId: id, type: body.type },
    })
    return NextResponse.json({ interaction })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
