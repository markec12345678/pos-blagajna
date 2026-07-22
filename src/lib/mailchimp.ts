// MailChimp integracija — sinhronizacija kupcev z newsletter seznamom
import { db } from '@/lib/db'
import { createHash } from 'crypto'

interface MailchimpConfig {
  apiKey: string
  serverPrefix: string // npr. "us1" iz API ključa
  listId: string       // audience/list ID
}

export function getMailchimpConfig(): MailchimpConfig | null {
  const apiKey = process.env.MAILCHIMP_API_KEY
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX
  const listId = process.env.MAILCHIMP_LIST_ID
  if (apiKey && serverPrefix && listId) {
    return { apiKey, serverPrefix, listId }
  }
  return null
}

export function isMailchimpConfigured(): boolean {
  return getMailchimpConfig() !== null
}

/**
 * Dodaj ali posodobi člana v MailChimp seznamu
 */
export async function addOrUpdateMember(
  email: string,
  firstName: string,
  lastName: string = '',
  tags: string[] = []
): Promise<{ success: boolean; message?: string; error?: string }> {
  const config = getMailchimpConfig()
  if (!config) {
    return { success: false, error: 'MailChimp ni konfiguriran' }
  }

  try {
    // MailChimp subscriber hash (MD5 of lowercase email)
    const subscriberHash = createHash('md5')
      .update(email.toLowerCase())
      .digest('hex')

    const url = `https://${config.serverPrefix}.api.mailchimp.com/3.0/lists/${config.listId}/members/${subscriberHash}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${Buffer.from(`anystring:${config.apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
        },
        tags: tags.length > 0 ? tags : undefined,
      }),
    })

    if (response.ok) {
      return { success: true, message: `Kupec ${email} sinhroniziran z MailChimp` }
    }

    const errorData = await response.json()
    return { success: false, error: errorData.detail || `Napaka ${response.status}` }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * Sinhroniziraj vse kupce z MailChimp
 */
export async function syncAllCustomers(): Promise<{
  synced: number
  failed: number
  errors: string[]
}> {
  const config = getMailchimpConfig()
  if (!config) {
    return { synced: 0, failed: 0, errors: ['MailChimp ni konfiguriran'] }
  }

  const customers = await db.customer.findMany({
    where: { email: { not: null } },
    select: { id: true, name: true, email: true, segment: true },
  })

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const customer of customers) {
    const [firstName, ...lastNameParts] = customer.name.split(' ')
    const result = await addOrUpdateMember(
      customer.email!,
      firstName,
      lastNameParts.join(' '),
      [customer.segment] // tag z segmentom
    )
    if (result.success) {
      synced++
    } else {
      failed++
      errors.push(`${customer.name}: ${result.error}`)
    }
    // Rate limiting (MailChimp dovoli 10 req/s)
    await new Promise(r => setTimeout(r, 100))
  }

  return { synced, failed, errors }
}
