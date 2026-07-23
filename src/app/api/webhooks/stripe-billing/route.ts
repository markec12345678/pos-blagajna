// API: POST /api/webhooks/stripe-billing — Stripe billing webhook
// Obdeluje subscription dogodke (SaaS billing)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Manjka Stripe signature' }, { status: 400 })
  }

  const endpointSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET
  if (!endpointSecret) {
    return NextResponse.json({ error: 'Billing webhook ni konfiguriran' }, { status: 400 })
  }

  try {
    const event = JSON.parse(body)
    const eventType = event.type
    const data = event.data?.object

    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })

    switch (eventType) {
      case 'checkout.session.completed': {
        const tenantId = data?.metadata?.tenantId
        const plan = data?.metadata?.plan
        if (tenantId && plan) {
          await db.tenant.update({
            where: { id: tenantId },
            data: {
              plan,
              subscriptionStatus: 'active',
              stripeSubscriptionId: data?.subscription,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          })
          if (adminUser) {
            await logAudit({
              userId: adminUser.id, action: 'webhook', entityType: 'billing',
              entityId: tenantId,
              description: `Stripe checkout completed: tenant=${tenantId}, plan=${plan}`,
              metadata: { tenantId, plan, subscriptionId: data?.subscription },
            })
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const customerId = data?.customer
        const status = data?.status
        const periodEnd = data?.current_period_end
        const tenant = await db.tenant.findFirst({ where: { stripeCustomerId: customerId } })
        if (tenant) {
          await db.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: status,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
              cancelAtPeriodEnd: data?.cancel_at_period_end || false,
            },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const customerId = data?.customer
        const tenant = await db.tenant.findFirst({ where: { stripeCustomerId: customerId } })
        if (tenant) {
          await db.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionStatus: 'canceled', active: false },
          })
          if (adminUser) {
            await logAudit({
              userId: adminUser.id, action: 'webhook', entityType: 'billing',
              entityId: tenant.id,
              description: `Stripe subscription canceled: ${tenant.name}`,
            })
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const customerId = data?.customer
        const tenant = await db.tenant.findFirst({ where: { stripeCustomerId: customerId } })
        if (tenant) {
          await db.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionStatus: 'past_due' },
          })
        }
        break
      }

      default:
        console.log(`[Stripe Billing Webhook] ${eventType}`)
    }

    return NextResponse.json({ received: true, type: eventType })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
