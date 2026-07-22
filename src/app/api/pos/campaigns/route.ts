// API: POST /api/pos/campaigns - ustvari in pošlji email kampanjo (admin only)
// Telo: { subject, html, segments?: string[], testEmail?: string }
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { subject, html, segments, testEmail } = body

    if (!subject || !html) {
      return NextResponse.json({ error: 'Manjka zadeva ali vsebina' }, { status: 400 })
    }

    // Testni email
    if (testEmail) {
      if (!isEmailConfigured()) {
        return NextResponse.json({ error: 'Email ni konfiguriran' }, { status: 400 })
      }
      const ok = await sendEmail(testEmail, `[TEST] ${subject}`, html)
      return NextResponse.json({ success: ok, message: ok ? `Testni email poslan na ${testEmail}` : 'Napaka pri pošiljanju' })
    }

    // Pošlji vsem kupcem z emailom (optionally po segmentih)
    const where: any = { email: { not: null } }
    if (segments && segments.length > 0) {
      where.segment = { in: segments }
    }

    const customers = await db.customer.findMany({
      where,
      select: { id: true, name: true, email: true, segment: true },
    })

    if (customers.length === 0) {
      return NextResponse.json({ error: 'Ni kupcev z email naslovom' }, { status: 400 })
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({
        error: 'Email ni konfiguriran. Nastavi SMTP env spremenljivke.',
        recipients: customers.length,
      }, { status: 400 })
    }

    // Pošlji email vsakemu kupcu (z delay med pošiljanji za preprečitev rate limit)
    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const customer of customers) {
      try {
        // Personaliziraj email z imenom kupca
        const personalizedHtml = html.replace(/{ime}/g, customer.name).replace(/{name}/g, customer.name)
        const ok = await sendEmail(customer.email!, subject, personalizedHtml)
        if (ok) {
          sent++
        } else {
          failed++
          errors.push(`${customer.name}: send failed`)
        }
        // Mali delay (50ms) za preprečitev rate limit
        await new Promise(r => setTimeout(r, 50))
      } catch (e: any) {
        failed++
        errors.push(`${customer.name}: ${e.message}`)
      }
    }

    await logAudit({
      userId: auth.id,
      action: 'create',
      entityType: 'campaign',
      description: `Email kampanja "${subject}" — poslano ${sent}/${customers.length}`,
      metadata: { subject, sent, failed, segments },
    })

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: customers.length,
      errors: errors.slice(0, 10),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
