// Stripe payment service
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null
  stripeInstance = new Stripe(secretKey)
  return stripeInstance
}

export function isStripeConfigured(): boolean {
  return getStripe() !== null
}

export function getPublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null
}

// Create a PaymentIntent for online ordering
export async function createPaymentIntent(
  amount: number, // v EUR (npr. 12.50)
  metadata?: Record<string, string>
): Promise<{ clientSecret?: string; paymentIntentId?: string; error?: string }> {
  const stripe = getStripe()
  if (!stripe) {
    return { error: 'Stripe ni konfiguriran. Nastavi STRIPE_SECRET_KEY v .env' }
  }
  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe zahteva cente
      currency: 'eur',
      metadata,
      automatic_payment_methods: { enabled: true },
    })
    return { clientSecret: intent.client_secret!, paymentIntentId: intent.id }
  } catch (e: any) {
    return { error: e.message }
  }
}

// Verify payment status
export async function verifyPayment(paymentIntentId: string): Promise<{ paid: boolean; amount?: number; error?: string }> {
  const stripe = getStripe()
  if (!stripe) {
    return { error: 'Stripe ni konfiguriran' }
  }
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
    return {
      paid: intent.status === 'succeeded',
      amount: intent.amount / 100, // pretvori nazaj v EUR
    }
  } catch (e: any) {
    return { error: e.message }
  }
}
