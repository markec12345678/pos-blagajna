// API: GET /api/pos/billing/status - status naročnine za tenant
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId')

    const where: any = {}
    if (tenantId) where.id = tenantId

    const tenants = await db.tenant.findMany({
      where,
      include: { _count: { select: { users: true } } },
    })

    const billing = tenants.map(t => ({
      id: t.id,
      name: t.name,
      plan: t.plan,
      subscriptionStatus: t.subscriptionStatus,
      currentPeriodEnd: t.currentPeriodEnd,
      cancelAtPeriodEnd: t.cancelAtPeriodEnd,
      trialEndsAt: t.trialEndsAt,
      stripeCustomerId: t.stripeCustomerId,
      userCount: t._count.users,
      maxUsers: t.maxUsers,
      maxLocations: t.maxLocations,
      daysUntilTrialEnds: t.trialEndsAt
        ? Math.ceil((t.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      isActive: t.active && (
        t.subscriptionStatus === 'active' ||
        t.subscriptionStatus === 'trialing' ||
        (t.trialEndsAt && t.trialEndsAt > new Date())
      ),
    }))

    return NextResponse.json({ billing })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
