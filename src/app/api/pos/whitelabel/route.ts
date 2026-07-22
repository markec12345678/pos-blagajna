// API: GET/PATCH /api/pos/whitelabel - upravljanje white-label nastavitev
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId')

    const tenants = await db.tenant.findMany({
      where: tenantId ? { id: tenantId } : {},
      select: {
        id: true,
        name: true,
        customLogoUrl: true,
        customPrimaryColor: true,
        customName: true,
        customDomain: true,
        plan: true,
      },
    })

    return NextResponse.json({ tenants })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { tenantId, customLogoUrl, customPrimaryColor, customName, customDomain } = body

    if (!tenantId) {
      return NextResponse.json({ error: 'Manjka tenantId' }, { status: 400 })
    }

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant ni najden' }, { status: 404 })
    }

    // White-label je na voljo samo za pro in enterprise plan
    if (tenant.plan === 'starter') {
      return NextResponse.json({
        error: 'White-label je na voljo samo za Pro in Enterprise plan. Nadgradite naročnino.',
      }, { status: 403 })
    }

    // Validiraj barvo (hex format)
    if (customPrimaryColor && !/^#[0-9A-Fa-f]{6}$/.test(customPrimaryColor)) {
      return NextResponse.json({ error: 'Barva mora biti v hex formatu (npr. #059669)' }, { status: 400 })
    }

    const updated = await db.tenant.update({
      where: { id: tenantId },
      data: {
        customLogoUrl: customLogoUrl !== undefined ? customLogoUrl || null : undefined,
        customPrimaryColor: customPrimaryColor !== undefined ? customPrimaryColor || null : undefined,
        customName: customName !== undefined ? customName || null : undefined,
        customDomain: customDomain !== undefined ? customDomain || null : undefined,
      },
    })

    await logAudit({
      userId: auth.id,
      action: 'update',
      entityType: 'whitelabel',
      entityId: tenantId,
      description: `White-label posodobljen za: ${tenant.name}`,
      metadata: { customName, customPrimaryColor, hasLogo: !!customLogoUrl, customDomain },
    })

    return NextResponse.json({ tenant: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
