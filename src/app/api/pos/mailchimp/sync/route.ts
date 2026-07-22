// API: POST /api/pos/mailchimp/sync - sinhroniziraj kupce z MailChimp (admin only)
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { syncAllCustomers, isMailchimpConfigured } from '@/lib/mailchimp'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    if (!isMailchimpConfigured()) {
      return NextResponse.json({
        error: 'MailChimp ni konfiguriran. Nastavi MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_LIST_ID v .env',
      }, { status: 400 })
    }

    const result = await syncAllCustomers()

    await logAudit({
      userId: auth.id,
      action: 'sync',
      entityType: 'mailchimp',
      description: `MailChimp sinhronizacija: ${result.synced} uspešnih, ${result.failed} neuspelih`,
      metadata: { synced: result.synced, failed: result.failed },
    })

    return NextResponse.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.slice(0, 10),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
