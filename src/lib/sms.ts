// SMS service — Twilio integracija za SMS obvestila
import twilio from 'twilio'

interface SmsConfig {
  accountSid: string
  authToken: string
  fromNumber: string
}

let client: twilio.Twilio | null = null
let cachedConfig: SmsConfig | null = null

export function getSmsConfig(): SmsConfig | null {
  if (cachedConfig) return cachedConfig
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const config: SmsConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    }
    cachedConfig = config
    client = twilio(config.accountSid, config.authToken)
    return config
  }
  return null
}

export function isSmsConfigured(): boolean {
  return getSmsConfig() !== null
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const config = getSmsConfig()
  if (!config || !client) {
    console.warn('[SMS] Not configured — skipping SMS to', to)
    return { success: false, error: 'SMS ni konfiguriran. Nastavi TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER v .env' }
  }
  if (!config.fromNumber) {
    return { success: false, error: 'Manjka TWILIO_FROM_NUMBER' }
  }
  try {
    // Očisti telefonsko številko (samo številke in +)
    const cleanTo = to.replace(/[^\d+]/g, '')
    if (!cleanTo.startsWith('+')) {
      return { success: false, error: 'Telefonska številka mora vsebovati državno kodo (npr. +386...)' }
    }
    const message = await client.messages.create({
      body: body.substring(0, 1600), // Twilio limit
      from: config.fromNumber,
      to: cleanTo,
    })
    return { success: true, message: `SMS poslan (SID: ${message.sid.substring(0, 12)}...)` }
  } catch (e: any) {
    console.error('[SMS] Send failed:', e.message)
    return { success: false, error: e.message }
  }
}

// Helper: potrditev rezervacije
export async function sendReservationSms(
  to: string,
  customerName: string,
  restaurantName: string,
  datetime: Date,
  partySize: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  const formattedDate = new Intl.DateTimeFormat('sl-SI', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  }).format(datetime)
  const body = `Potrditev rezervacije — ${restaurantName}
${customerName}, vaša rezervacija za ${partySize} oseb je sprejeta.
Datum: ${formattedDate}
Hvala! ${restaurantName}`
  return sendSms(to, body)
}

// Helper: opozorilo o nizki zalogi (za admina)
export async function sendLowStockSms(
  to: string,
  restaurantName: string,
  productNames: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  const body = `⚠ NIZKA ZALOGA — ${restaurantName}
${productNames.length} izdelkov potrebuje dopolnitev:
${productNames.slice(0, 5).join(', ')}${productNames.length > 5 ? ` in ${productNames.length - 5} več` : ''}`
  return sendSms(to, body)
}
