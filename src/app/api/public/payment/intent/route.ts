// API: POST /api/public/payment/intent - ustvari Stripe PaymentIntent za online naročilo
// Javni API (brez auth) — stranka plačuje preko /menu strani
import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, isStripeConfigured } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, items } = body
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Napačen znesek' }, { status: 400 })
    }
    if (amount > 10000) {
      return NextResponse.json({ error: 'Najvišji znesek je 10.000 €' }, { status: 400 })
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({
        error: 'Online plačila niso konfigurirana. Kontaktirajte restavracijo za plačilo na blagajni.',
      }, { status: 503 })
    }
    const metadata: Record<string, string> = {
      source: 'online_menu',
      itemCount: String(items?.length || 0),
    }
    const result = await createPaymentIntent(amount, metadata)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
