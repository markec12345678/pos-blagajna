// API: POST /api/public/payment/verify - preveri status plačila
import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { paymentIntentId } = body
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Manjka paymentIntentId' }, { status: 400 })
    }
    const result = await verifyPayment(paymentIntentId)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({
      paid: result.paid,
      amount: result.amount,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
