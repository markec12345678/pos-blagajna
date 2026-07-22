// API: GET/POST /api/pos/tenant - upravljanje tenantov (organizacij)
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
    // Pridobi tenantove kjer je uporabnik član
    const userTenants = await db.userTenant.findMany({
      where: { userId: auth.id },
      include: {
        tenant: {
          include: { _count: { select: { users: true } } },
        },
      },
    })
    return NextResponse.json({
      tenants: userTenants.map(ut => ({
        ...ut.tenant,
        userRole: ut.role,
        userCount: ut.tenant._count.users,
      })),
    })
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
    const { name, code, plan } = body

    if (!name) {
      return NextResponse.json({ error: 'Manjka ime organizacije' }, { status: 400 })
    }

    // Ustvari tenant
    const tenant = await db.tenant.create({
      data: {
        name,
        code: code || null,
        plan: plan || 'starter',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-dnevni trial
      },
    })

    // Dodaj uporabnika kot admin v tenant
    await db.userTenant.create({
      data: {
        userId: auth.id,
        tenantId: tenant.id,
        role: 'admin',
      },
    })

    await logAudit({
      userId: auth.id,
      action: 'create',
      entityType: 'tenant',
      entityId: tenant.id,
      description: `Ustvarjena organizacija: ${tenant.name} (plan: ${tenant.plan})`,
      metadata: { name, plan: tenant.plan },
    })

    return NextResponse.json({ tenant })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
