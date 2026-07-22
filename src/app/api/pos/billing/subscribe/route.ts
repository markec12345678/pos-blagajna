// API: POST /api/pos/billing/subscribe - ustvari Stripe checkout session za SaaS plan
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { logAudit } from '@/lib/audit'

// Cene planov (v EUR/mesec)
const PLAN_PRICES: Record<string, { amount: number; name: string; maxUsers: number; maxLocations: number }> = {
  starter: { amount: 29, name: 'Starter', maxUsers: 5, maxLocations: 1 },
  pro: { amount: 79, name: 'Professional', maxUsers: 25, maxLocations: 5 },
  enterprise: { amount: 199, name: 'Enterprise', maxUsers: 100, maxLocations: 20 },
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { plan, tenantId } = body

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json({ error: 'Napačen plan. Na voljo: starter, pro, enterprise' }, { status: 400 })
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Stripe ni konfiguriran' }, { status: 400 })
    }

    const stripe = getStripe()!
    const planInfo = PLAN_PRICES[plan]

    // Pridobi ali ustvari Stripe customer
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant ni najden' }, { status: 404 })
    }

    let customerId = tenant.stripeCustomerId

    if (!customerId) {
      // Ustvari Stripe customer
      const customer = await stripe.customers.create({
        name: tenant.name,
        metadata: { tenantId: tenant.id, code: tenant.code || '' },
      })
      customerId = customer.id
      await db.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customerId },
      })
    }

    // Ustvari Stripe checkout session za subscription
    // V produkciji: uporabi Stripe Price ID-je namesto inline cen
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `POS Blagajna — ${planInfo.name}`,
            description: `${planInfo.maxUsers} uporabnikov, ${planInfo.maxLocations} lokacij`,
          },
          unit_amount: planInfo.amount * 100, // Stripe uporablja cente
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: `${req.headers.get('origin')}/admin?billing=success`,
      cancel_url: `${req.headers.get('origin')}/admin?billing=cancelled`,
      metadata: { tenantId, plan },
    })

    await logAudit({
      userId: auth.id,
      action: 'create',
      entityType: 'billing',
      entityId: session.id,
      description: `Stripe checkout ustvarjen za plan: ${planInfo.name} (${planInfo.amount} EUR/mesec)`,
      metadata: { plan, amount: planInfo.amount, tenantId },
    })

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
