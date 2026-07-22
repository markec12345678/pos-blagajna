// API: POST /api/pos/billing/portal - ustvari Stripe customer portal (upravljanje naročnine)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { tenantId } = body

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant || !tenant.stripeCustomerId) {
      return NextResponse.json({ error: 'Tenant nima Stripe customer ID' }, { status: 400 })
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Stripe ni konfiguriran' }, { status: 400 })
    }

    const stripe = getStripe()!
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${req.headers.get('origin')}/admin`,
    })

    return NextResponse.json({ portalUrl: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
