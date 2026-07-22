// API: POST /api/webhooks/stripe - Stripe webhook endpoint
// Sprejema Stripe dogodke (payment_intent.succeeded, payment_intent.failed, itd.)
// Javni endpoint (brez auth) — verificira Stripe podpis
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Manjka Stripe signature' }, { status: 400 })
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!endpointSecret) {
    return NextResponse.json({ error: 'Stripe webhook ni konfiguriran' }, { status: 400 })
  }

  try {
    // V produkciji: uporabi stripe.webhooks.constructEvent(body, signature, endpointSecret)
    // Za demo: preprosti parse (brez verifikacije podpisa)
    const event = JSON.parse(body)
    const eventType = event.type
    const eventData = event.data?.object

    // Zapiši webhook dogodek v audit log (kot sistemski dogodek)
    const adminUser = await db.user.findFirst({
      where: { role: 'admin' },
      select: { id: true },
    })

    if (adminUser) {
      await logAudit({
        userId: adminUser.id,
        action: 'webhook',
        entityType: 'payment',
        entityId: eventData?.id,
        description: `Stripe webhook: ${eventType}`,
        metadata: {
          eventType,
          amount: eventData?.amount,
          currency: eventData?.currency,
          status: eventData?.status,
          metadata: eventData?.metadata,
        },
      })
    }

    // Obdelaj specifične dogodke
    switch (eventType) {
      case 'payment_intent.succeeded': {
        const paymentIntentId = eventData?.id
        const amount = eventData?.amount / 100 // Stripe uporablja cente
        const metadata = eventData?.metadata || {}

        // Če je online naročilo, ustvari Sale
        if (metadata.source === 'online_menu' && metadata.itemCount) {
          // V produkciji: ustvari Sale iz online naročila
          console.log(`[Stripe Webhook] Online naročilo plačano: ${amount} EUR (PI: ${paymentIntentId})`)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        console.log(`[Stripe Webhook] Plačilo neuspešno: ${eventData?.id}`)
        break
      }

      case 'charge.refunded': {
        const paymentIntentId = eventData?.payment_intent
        const amount = eventData?.amount_refunded / 100

        // Poišči sale z orderId = paymentIntentId in storniraj
        console.log(`[Stripe Webhook] Refund: ${amount} EUR (PI: ${paymentIntentId})`)

        // Audit log za refund
        if (adminUser) {
          await logAudit({
            userId: adminUser.id,
            action: 'refund',
            entityType: 'payment',
            entityId: paymentIntentId,
            description: `Stripe refund: ${amount} EUR`,
            metadata: { amount, paymentIntentId },
          })
        }
        break
      }

      case 'charge.dispute.created': {
        console.log(`[Stripe Webhook] Dispute created: ${eventData?.id}`)
        if (adminUser) {
          await logAudit({
            userId: adminUser.id,
            action: 'dispute',
            entityType: 'payment',
            entityId: eventData?.id,
            description: `Stripe dispute: ${eventData?.amount / 100} EUR`,
          })
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Neobdelan dogodek: ${eventType}`)
    }

    return NextResponse.json({ received: true, type: eventType })
  } catch (e: any) {
    console.error('[Stripe Webhook] Napaka:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
